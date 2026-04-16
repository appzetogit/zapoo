import Order from '../order/models/Order.js';
import Payment from './models/Payment.js';
import OrderSettlement from '../order/models/OrderSettlement.js';
import { getRazorpayWebhookSecret } from '../../shared/utils/envService.js';
import { calculateOrderSettlement } from '../order/services/orderSettlementService.js';
import { holdEscrow } from '../order/services/escrowWalletService.js';
import { notifyRestaurantNewOrder } from '../order/services/restaurantNotificationService.js';
import { findOrderByIdentifier } from '../order/utils/findOrderByIdentifier.js';
import { upsertRefundFromWebhook } from '../refund/services/refundService.js';
import { initiateRazorpayRefundForOrder } from '../order/services/cancellationRefundService.js';

const ALLOWED_EVENTS = new Set([
  'payment.captured',
  'payment.failed',
  'refund.created',
  'refund.processed',
  'refund.failed'
]);
const webhookDebug = () => {};

const safeJsonParse = (input) => {
  if (!input) return null;
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(String(input));
  } catch {
    return null;
  }
};

const timingSafeEqualHex = (left, right) => {
  if (!left || !right) return false;
  const leftBuf = Buffer.from(String(left), 'utf8');
  const rightBuf = Buffer.from(String(right), 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

const verifyWebhookSignature = async (rawBody, providedSignature) => {
  const secret = await getRazorpayWebhookSecret();
  if (!secret) {
    throw new Error('Razorpay webhook secret is not configured');
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualHex(digest, providedSignature);
};

const getPaymentEntityOrderId = (paymentEntity = {}) => (
  paymentEntity.order_id || paymentEntity.orderId || null
);

const getPaymentEntityPaymentId = (paymentEntity = {}) => (
  paymentEntity.id || paymentEntity.paymentId || null
);

const resolveOrderForPaymentEvent = async (paymentEntity = {}) => {
  const razorpayOrderId = getPaymentEntityOrderId(paymentEntity);
  const notesOrderId = paymentEntity.notes?.orderId || paymentEntity.notes?.order_id || null;
  const notesOrderNumber = paymentEntity.notes?.orderNumber || null;

  let order = null;

  if (razorpayOrderId) {
    order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
  }

  if (!order && notesOrderId) {
    order = await findOrderByIdentifier(notesOrderId, { lean: false });
  }

  if (!order && notesOrderNumber) {
    order = await findOrderByIdentifier(notesOrderNumber, { lean: false });
  }

  return { order, razorpayOrderId };
};

const upsertPaymentRecord = async ({ order, paymentEntity, status, eventName, payload }) => {
  if (!order) {
    return null;
  }

  const razorpayOrderId = getPaymentEntityOrderId(paymentEntity) || order.payment?.razorpayOrderId || null;
  const paymentId = getPaymentEntityPaymentId(paymentEntity) || order.payment?.razorpayPaymentId || null;
  const paymentAmount = order.pricing?.total || paymentEntity.amount || 0;
  const paymentCurrency = paymentEntity.currency || 'INR';

  let payment = await Payment.findOne({
    orderId: order._id,
    ...(razorpayOrderId ? { 'razorpay.orderId': razorpayOrderId } : {})
  });

  if (!payment) {
    payment = new Payment({
      paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: order._id,
      userId: order.userId,
      amount: paymentAmount,
      currency: paymentCurrency,
      method: 'razorpay',
      status,
      razorpay: {
        orderId: razorpayOrderId,
        paymentId,
        signature: null,
        receipt: order.orderId,
        notes: paymentEntity.notes || null
      },
      gatewayResponse: paymentEntity,
      completedAt: status === 'success' ? new Date() : null,
      failedAt: status === 'failed' ? new Date() : null,
      logs: [{
        action: status,
        timestamp: new Date(),
        details: {
          event: eventName,
          razorpayOrderId,
          razorpayPaymentId: paymentId,
          note: 'Webhook upsert'
        }
      }],
      webhookEventHistory: [{
        event: eventName,
        receivedAt: new Date(),
        payload
      }]
    });
  } else {
    if (payment.status === 'success' && status === 'failed') {
      return payment;
    }

    payment.status = status;
    payment.amount = payment.amount || paymentAmount;
    payment.currency = payment.currency || paymentCurrency;
    payment.method = 'razorpay';
    payment.razorpay = {
      ...(payment.razorpay || {}),
      orderId: razorpayOrderId || payment.razorpay?.orderId || null,
      paymentId: paymentId || payment.razorpay?.paymentId || null,
      receipt: payment.razorpay?.receipt || order.orderId,
      notes: paymentEntity.notes || payment.razorpay?.notes || null
    };
    payment.gatewayResponse = paymentEntity;
    payment.completedAt = status === 'success' ? payment.completedAt || new Date() : payment.completedAt;
    payment.failedAt = status === 'failed' ? payment.failedAt || new Date() : payment.failedAt;
    payment.logs = payment.logs || [];
    payment.logs.push({
      action: status,
      timestamp: new Date(),
      details: {
        event: eventName,
        razorpayOrderId,
        razorpayPaymentId: paymentId,
        note: 'Webhook upsert'
      }
    });
    payment.webhookEventHistory = payment.webhookEventHistory || [];
    payment.webhookEventHistory.push({
      event: eventName,
      receivedAt: new Date(),
      payload
    });
  }

  await payment.save();
  return payment;
};

const handlePaymentCaptured = async ({ paymentEntity, payload }) => {
  webhookDebug('payment_captured_received', {
    paymentId: paymentEntity?.id || null,
    orderId: paymentEntity?.order_id || null,
    notesOrderId: paymentEntity?.notes?.orderId || null
  });
  const { order, razorpayOrderId } = await resolveOrderForPaymentEvent(paymentEntity);
  if (!order) {
    throw new Error('Order not found for captured payment');
  }

  const paymentId = getPaymentEntityPaymentId(paymentEntity);
  const cancelledForRefund = ['cancelled', 'refunded'].includes(String(order.status || '').toLowerCase().trim());
  webhookDebug('payment_captured_order_resolved', {
    orderId: order.orderId || order._id?.toString?.(),
    cancelledForRefund,
    orderStatus: order.status || null,
    paymentId: paymentEntity?.id || null
  });

  const updatedOrder = await Order.findOneAndUpdate(
    cancelledForRefund
      ? {
        _id: order._id
      }
      : {
        _id: order._id
      },
    cancelledForRefund
      ? {
        $set: {
          'payment.method': 'razorpay',
          'payment.status': 'completed',
          'payment.razorpayOrderId': razorpayOrderId || order.payment?.razorpayOrderId || null,
          'payment.razorpayPaymentId': paymentId || order.payment?.razorpayPaymentId || null,
          'payment.transactionId': paymentId || order.payment?.transactionId || null,
          'payment.razorpaySignature': order.payment?.razorpaySignature || null
        }
      }
      : {
        $set: {
          'payment.method': 'razorpay',
          'payment.status': 'completed',
          'payment.razorpayOrderId': razorpayOrderId || order.payment?.razorpayOrderId || null,
          'payment.razorpayPaymentId': paymentId || order.payment?.razorpayPaymentId || null,
          'payment.transactionId': paymentId || order.payment?.transactionId || null,
          'payment.razorpaySignature': order.payment?.razorpaySignature || null
        }
      },
    { new: true }
  );

  const payment = await upsertPaymentRecord({
    order,
    paymentEntity,
    status: 'success',
    eventName: 'payment.captured',
    payload
  });

  if (!updatedOrder) {
    return {
      order,
      payment,
      alreadyProcessed: true
    };
  }

  if (cancelledForRefund) {
    try {
      webhookDebug('payment_captured_autorefund_start', {
        orderId: updatedOrder._id?.toString?.() || null,
        paymentId: paymentEntity?.id || null
      });
      const refundResult = await initiateRazorpayRefundForOrder({
        orderId: updatedOrder._id,
        trigger: 'webhook',
        reason: updatedOrder.cancellationReason || paymentEntity.notes?.reason || 'Cancelled order captured by Razorpay'
      });
      webhookDebug('payment_captured_autorefund_done', {
        orderId: updatedOrder._id?.toString?.() || null,
        refundInitiated: refundResult?.refundInitiated || false,
        refundQueued: refundResult?.refundQueued || false,
        refundId: refundResult?.refundId || null
      });
      return {
        order: updatedOrder,
        payment,
        refundInitiated: refundResult?.refundInitiated || false,
        refundQueued: refundResult?.refundQueued || false,
        alreadyProcessed: true
      };
    } catch (refundError) {
      console.error('[RAZORPAY_WEBHOOK] Auto-refund initiation failed:', refundError);
      return {
        order: updatedOrder,
        payment,
        refundInitiated: false,
        refundError: refundError.message,
        alreadyProcessed: true
      };
    }
  }

  try {
    await calculateOrderSettlement(updatedOrder._id);
  } catch (settlementError) {
    console.error('[RAZORPAY_WEBHOOK] Settlement calculation failed:', settlementError);
  }

  try {
    await holdEscrow(updatedOrder._id, updatedOrder.userId, updatedOrder.pricing?.total || 0);
  } catch (escrowError) {
    console.error('[RAZORPAY_WEBHOOK] Escrow hold failed:', escrowError);
  }

  try {
    const restaurantId = updatedOrder.restaurantId?.toString?.() || updatedOrder.restaurantId;
    if (restaurantId) {
      await notifyRestaurantNewOrder(updatedOrder, restaurantId);
    }
  } catch (notificationError) {
    console.error('[RAZORPAY_WEBHOOK] Restaurant notification failed:', notificationError);
  }

  return {
    order: updatedOrder,
    payment,
    alreadyProcessed: false
  };
};

const handlePaymentFailed = async ({ paymentEntity, payload }) => {
  webhookDebug('payment_failed_received', {
    paymentId: paymentEntity?.id || null,
    orderId: paymentEntity?.order_id || null
  });
  const { order, razorpayOrderId } = await resolveOrderForPaymentEvent(paymentEntity);
  if (!order) {
    throw new Error('Order not found for failed payment');
  }

  const paymentId = getPaymentEntityPaymentId(paymentEntity);
  const existingPayment = await Payment.findOne({
    orderId: order._id,
    ...(razorpayOrderId ? { 'razorpay.orderId': razorpayOrderId } : {})
  });

  if (order.status === 'confirmed' || existingPayment?.status === 'success') {
    return {
      order,
      payment: existingPayment,
      alreadyProcessed: true
    };
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: { $in: ['pending', 'failed'] }
    },
    {
      $set: {
        status: 'failed',
        'payment.method': 'razorpay',
        'payment.status': 'failed',
        'payment.razorpayOrderId': razorpayOrderId || order.payment?.razorpayOrderId || null,
        'payment.razorpayPaymentId': paymentId || order.payment?.razorpayPaymentId || null,
        'payment.transactionId': paymentId || order.payment?.transactionId || null
      }
    },
    { new: true }
  );

  const payment = await upsertPaymentRecord({
    order,
    paymentEntity,
    status: 'failed',
    eventName: 'payment.failed',
    payload
  });

  if (!updatedOrder) {
    return {
      order,
      payment,
      alreadyProcessed: true
    };
  }

  return {
    order: updatedOrder,
    payment,
    alreadyProcessed: false
  };
};

const syncOrderRefundState = async ({ refund, eventName }) => {
  if (!refund?.orderId) {
    return null;
  }

  if (eventName !== 'refund.processed') {
    return null;
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: refund.orderId,
      status: { $ne: 'refunded' }
    },
    {
      $set: {
        status: 'refunded',
        'payment.razorpayPaymentId': refund.paymentId || null,
        refundedAt: new Date()
      }
    },
    { new: true }
  );
  webhookDebug('sync_order_refund_state', {
    eventName,
    orderId: refund.orderId?.toString?.() || refund.orderId || null,
    refundId: refund.refundId || null,
    updated: Boolean(order)
  });

  return order;
};

const syncPaymentRefundState = async ({ refund, eventName }) => {
  if (!refund?.paymentId) {
    return null;
  }

  const payment = await Payment.findOne({ 'razorpay.paymentId': refund.paymentId });
  if (!payment) {
    return null;
  }

  const nextStatus = eventName === 'refund.processed'
    ? 'success'
    : eventName === 'refund.failed'
      ? 'failed'
      : 'pending';

  if (payment.refund?.status === 'success' && nextStatus !== 'success') {
    return payment;
  }

  if (payment.refund?.status === 'failed' && nextStatus === 'pending') {
    return payment;
  }

  payment.refund = payment.refund || {};
  payment.refund.amount = refund.amount;
  payment.refund.status = nextStatus;
  payment.refund.refundId = refund.refundId;
  payment.refund.refundedAt = eventName === 'refund.processed' ? new Date() : null;
  payment.refund.reason = refund.reason || null;
  payment.webhookEventHistory = payment.webhookEventHistory || [];
  payment.webhookEventHistory.push({
    event: eventName,
    receivedAt: new Date(),
    payload: refund.gatewayResponse || null
  });
  await payment.save();
  webhookDebug('sync_payment_refund_state', {
    eventName,
    paymentId: refund.paymentId || null,
    refundId: refund.refundId || null,
    nextStatus,
    updated: true
  });

  return payment;
};

const handleRefundCreated = async ({ refundEntity, payload }) => {
  webhookDebug('refund_created_received', {
    refundId: refundEntity?.id || null,
    paymentId: refundEntity?.payment_id || null,
    orderId: refundEntity?.order_id || null
  });
  const refund = await upsertRefundFromWebhook({
    refundEntity,
    eventName: 'refund.created',
    orderId: refundEntity.order_id || null,
    paymentId: refundEntity.payment_id || null,
    payload
  });

  await syncPaymentRefundState({ refund, eventName: 'refund.created' });

  return refund;
};

const handleRefundProcessed = async ({ refundEntity, payload }) => {
  webhookDebug('refund_processed_received', {
    refundId: refundEntity?.id || null,
    paymentId: refundEntity?.payment_id || null,
    orderId: refundEntity?.order_id || null
  });
  const refund = await upsertRefundFromWebhook({
    refundEntity,
    eventName: 'refund.processed',
    orderId: refundEntity.order_id || null,
    paymentId: refundEntity.payment_id || null,
    payload
  });

  const [order, payment] = await Promise.all([
    syncOrderRefundState({ refund, eventName: 'refund.processed' }),
    syncPaymentRefundState({ refund, eventName: 'refund.processed' })
  ]);

  const settlement = refund.orderId ? await OrderSettlement.findOne({ orderId: refund.orderId }) : null;
  if (settlement) {
    settlement.cancellationDetails = settlement.cancellationDetails || {};
    settlement.cancellationDetails.refundStatus = 'processed';
    settlement.cancellationDetails.razorpayRefundId = refund.refundId;
    settlement.cancellationDetails.refundProcessedAt = new Date();
    settlement.escrowStatus = 'refunded';
    settlement.settlementStatus = 'cancelled';
    if (settlement.restaurantEarning) settlement.restaurantEarning.status = 'cancelled';
    if (settlement.deliveryPartnerEarning) settlement.deliveryPartnerEarning.status = 'cancelled';
    if (settlement.adminEarning) settlement.adminEarning.status = 'cancelled';
    await settlement.save();
  }
  webhookDebug('refund_processed_finalized', {
    refundId: refund.refundId || null,
    orderId: refund.orderId?.toString?.() || refund.orderId || null,
    paymentId: refund.paymentId || null,
    settlementUpdated: Boolean(settlement)
  });

  return {
    refund,
    order,
    payment
  };
};

const handleRefundFailed = async ({ refundEntity, payload }) => {
  webhookDebug('refund_failed_received', {
    refundId: refundEntity?.id || null,
    paymentId: refundEntity?.payment_id || null,
    orderId: refundEntity?.order_id || null
  });
  const refund = await upsertRefundFromWebhook({
    refundEntity,
    eventName: 'refund.failed',
    orderId: refundEntity.order_id || null,
    paymentId: refundEntity.payment_id || null,
    payload
  });

  await syncPaymentRefundState({ refund, eventName: 'refund.failed' });

  const settlement = refund.orderId ? await OrderSettlement.findOne({ orderId: refund.orderId }) : null;
  if (settlement) {
    settlement.cancellationDetails = settlement.cancellationDetails || {};
    settlement.cancellationDetails.refundStatus = 'failed';
    settlement.cancellationDetails.refundFailureReason = refund.failureReason || 'Refund failed';
    settlement.cancellationDetails.refundProcessedAt = new Date();
    await settlement.save();
  }
  webhookDebug('refund_failed_finalized', {
    refundId: refund.refundId || null,
    orderId: refund.orderId?.toString?.() || refund.orderId || null,
    paymentId: refund.paymentId || null,
    settlementUpdated: Boolean(settlement)
  });

  return refund;
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const rawBody = typeof req.rawBody === 'string' && req.rawBody.length
      ? req.rawBody
      : typeof req.body === 'string'
        ? req.body
        : null;

    if (!rawBody) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay webhook signature' });
    }

    const isValid = await verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid Razorpay webhook signature' });
    }

    const body = safeJsonParse(rawBody);
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }

    const { event, payload = {} } = body;
    webhookDebug('webhook_event_received', {
      event,
      hasPaymentEntity: Boolean(payload?.payment?.entity),
      hasRefundEntity: Boolean(payload?.refund?.entity)
    });
    if (!ALLOWED_EVENTS.has(event)) {
      webhookDebug('webhook_event_ignored', { event });
      return res.status(200).json({ success: true, ignored: true, event });
    }

    const paymentEntity = payload?.payment?.entity || null;
    const refundEntity = payload?.refund?.entity || null;

    if (event === 'payment.captured') {
      await handlePaymentCaptured({ paymentEntity, payload });
    } else if (event === 'payment.failed') {
      await handlePaymentFailed({ paymentEntity, payload });
    } else if (event === 'refund.created') {
      await handleRefundCreated({ refundEntity, payload });
    } else if (event === 'refund.processed') {
      await handleRefundProcessed({ refundEntity, payload });
    } else if (event === 'refund.failed') {
      await handleRefundFailed({ refundEntity, payload });
    }

    webhookDebug('webhook_event_processed', { event });
    return res.status(200).json({ success: true, received: true, event });
  } catch (error) {
    console.error('[RAZORPAY_WEBHOOK] Handler error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process webhook'
    });
  }
};
