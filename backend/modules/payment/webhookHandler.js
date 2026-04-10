import crypto from 'crypto';
import Order from '../order/models/Order.js';
import Payment from './models/Payment.js';
import OrderSettlement from '../order/models/OrderSettlement.js';
import { getRazorpayWebhookSecret } from '../../shared/utils/envService.js';
import { calculateOrderSettlement } from '../order/services/orderSettlementService.js';
import { holdEscrow } from '../order/services/escrowWalletService.js';
import { notifyRestaurantNewOrder } from '../order/services/restaurantNotificationService.js';
import { findOrderByIdentifier } from '../order/utils/findOrderByIdentifier.js';
import { upsertRefundFromWebhook } from '../refund/services/refundService.js';

const ALLOWED_EVENTS = new Set([
  'payment.captured',
  'payment.failed',
  'refund.created',
  'refund.processed',
  'refund.failed'
]);

const safeJsonParse = (input) => {
  if (!input) return null;
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(String(input));
  } catch {
    return null;
  }
};

const timingSafeEqualHex = (a, b) => {
  if (!a || !b) return false;
  const aBuf = Buffer.from(String(a), 'utf8');
  const bBuf = Buffer.from(String(b), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const verifyWebhookSignature = async (rawBody, providedSignature) => {
  const secret = await getRazorpayWebhookSecret();
  if (!secret) {
    throw new Error('Razorpay webhook secret is not configured');
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualHex(digest, providedSignature);
};

const resolveOrderForPaymentEvent = async (paymentEntity = {}) => {
  const razorpayOrderId = paymentEntity.order_id || paymentEntity.orderId || null;
  const notesOrderId = paymentEntity.notes?.orderId || paymentEntity.notes?.order_id || null;

  let order = null;

  if (razorpayOrderId) {
    order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId });
  }

  if (!order && notesOrderId) {
    order = await findOrderByIdentifier(notesOrderId, { lean: false });
  }

  if (!order && paymentEntity.notes?.orderNumber) {
    order = await findOrderByIdentifier(paymentEntity.notes.orderNumber, { lean: false });
  }

  return { order, razorpayOrderId };
};

const upsertPaymentRecord = async ({ order, paymentEntity, status, extraLogs = [] }) => {
  const razorpayOrderId = paymentEntity.order_id || paymentEntity.orderId || order?.payment?.razorpayOrderId || null;
  const paymentId = paymentEntity.id || order?.payment?.razorpayPaymentId || null;
  if (!order) {
    return null;
  }

  let payment = await Payment.findOne({
    orderId: order._id,
    ...(razorpayOrderId ? { 'razorpay.orderId': razorpayOrderId } : {})
  });

  if (!payment) {
    payment = new Payment({
      paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: order._id,
      userId: order.userId,
      amount: order.pricing?.total || paymentEntity.amount || 0,
      currency: paymentEntity.currency || 'INR',
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
      logs: []
    });
  } else {
    payment.status = status;
    payment.amount = payment.amount || order.pricing?.total || paymentEntity.amount || 0;
    payment.currency = paymentEntity.currency || payment.currency || 'INR';
    payment.method = 'razorpay';
    payment.razorpay = {
      ...(payment.razorpay || {}),
      orderId: razorpayOrderId || payment.razorpay?.orderId || null,
      paymentId: paymentId || payment.razorpay?.paymentId || null,
      receipt: payment.razorpay?.receipt || order.orderId,
      notes: paymentEntity.notes || payment.razorpay?.notes || null
    };
    payment.gatewayResponse = paymentEntity;
    payment.completedAt = status === 'success' ? new Date() : payment.completedAt;
    payment.failedAt = status === 'failed' ? new Date() : payment.failedAt;
    payment.logs = payment.logs || [];
  }

  payment.logs.push({
    action: status,
    timestamp: new Date(),
    details: {
      event: `payment.${status === 'success' ? 'captured' : status === 'failed' ? 'failed' : 'updated'}`,
      razorpayOrderId,
      razorpayPaymentId: paymentId
    }
  });

  await payment.save();
  return payment;
};

const handlePaymentCaptured = async ({ paymentEntity }) => {
  const { order } = await resolveOrderForPaymentEvent(paymentEntity);
  if (!order) {
    if (paymentEntity?.notes?.type && paymentEntity.notes.type !== 'order_payment') {
      return { ignored: true };
    }
    throw new Error('Order not found for captured payment');
  }

  const existingPayment = await Payment.findOne({ orderId: order._id }).lean();
  const alreadyConfirmed = order.status === 'confirmed' || existingPayment?.status === 'success';
  const payment = await upsertPaymentRecord({
    order,
    paymentEntity,
    status: 'success'
  });

  order.payment = order.payment || {};
  order.payment.method = order.payment.method || 'razorpay';
  order.payment.status = 'completed';
  order.payment.razorpayOrderId = paymentEntity.order_id || paymentEntity.orderId || order.payment.razorpayOrderId || null;
  order.payment.razorpayPaymentId = paymentEntity.id || order.payment.razorpayPaymentId || null;
  order.payment.transactionId = paymentEntity.id || order.payment.transactionId || null;
  order.status = 'confirmed';
  await order.save();

  if (alreadyConfirmed) {
    return { order, payment, alreadyProcessed: true };
  }

  try {
    await calculateOrderSettlement(order._id);
  } catch (settlementError) {
    console.error('[RAZORPAY_WEBHOOK] Settlement calculation failed:', settlementError);
  }

  try {
    await holdEscrow(order._id, order.userId, order.pricing?.total || 0);
  } catch (escrowError) {
    console.error('[RAZORPAY_WEBHOOK] Escrow hold failed:', escrowError);
  }

  try {
    const restaurantId = order.restaurantId?.toString?.() || order.restaurantId;
    if (restaurantId) {
      await notifyRestaurantNewOrder(order, restaurantId);
    }
  } catch (notificationError) {
    console.error('[RAZORPAY_WEBHOOK] Restaurant notification failed:', notificationError);
  }

  return { order, payment, alreadyProcessed: false };
};

const handlePaymentFailed = async ({ paymentEntity }) => {
  const { order } = await resolveOrderForPaymentEvent(paymentEntity);
  if (!order) {
    if (paymentEntity?.notes?.type && paymentEntity.notes.type !== 'order_payment') {
      return { ignored: true };
    }
    throw new Error('Order not found for failed payment');
  }

  const existingPayment = await Payment.findOne({ orderId: order._id }).lean();
  if (order.status === 'confirmed' || existingPayment?.status === 'success') {
    return { order, alreadyProcessed: true };
  }

  await upsertPaymentRecord({
    order,
    paymentEntity,
    status: 'failed'
  });

  order.payment = order.payment || {};
  order.payment.method = order.payment.method || 'razorpay';
  order.payment.status = 'failed';
  order.payment.razorpayOrderId = paymentEntity.order_id || paymentEntity.orderId || order.payment.razorpayOrderId || null;
  order.payment.razorpayPaymentId = paymentEntity.id || order.payment.razorpayPaymentId || null;
  order.payment.transactionId = paymentEntity.id || order.payment.transactionId || null;
  order.status = 'failed';
  await order.save();

  return { order, alreadyProcessed: false };
};

const handleRefundCreated = async ({ refundEntity, payload }) => {
  if (refundEntity?.notes?.type && refundEntity.notes.type !== 'order_refund') {
    return { ignored: true };
  }
  const refund = await upsertRefundFromWebhook({
    refundEntity,
    eventName: 'refund.created',
    orderId: refundEntity.order_id || null,
    paymentId: refundEntity.payment_id || null,
    payload
  });

  const paymentId = refundEntity.payment_id || refund.paymentId;
  if (paymentId) {
    const payment = await Payment.findOne({ 'razorpay.paymentId': paymentId });
    if (payment) {
      payment.refund = payment.refund || {};
      payment.refund.amount = refund.amount;
      payment.refund.status = 'none';
      payment.refund.refundId = refund.refundId;
      payment.refund.refundedAt = null;
      payment.refund.reason = refund.reason || null;
      await payment.save();
    }
  }

  return refund;
};

const handleRefundProcessed = async ({ refundEntity, payload }) => {
  if (refundEntity?.notes?.type && refundEntity.notes.type !== 'order_refund') {
    return { ignored: true };
  }
  const refund = await upsertRefundFromWebhook({
    refundEntity,
    eventName: 'refund.processed',
    orderId: refundEntity.order_id || null,
    paymentId: refundEntity.payment_id || null,
    payload
  });

  const paymentId = refundEntity.payment_id || refund.paymentId;
  const order = refund.orderId ? await Order.findById(refund.orderId) : null;
  if (order) {
    order.status = 'refunded';
    order.payment = order.payment || {};
    order.payment.status = 'refunded';
    order.payment.razorpayPaymentId = paymentId || order.payment.razorpayPaymentId || null;
    order.refundedAt = new Date();
    await order.save();
  }

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

  const payment = paymentId ? await Payment.findOne({ 'razorpay.paymentId': paymentId }) : null;
  if (payment) {
    payment.refund = payment.refund || {};
    payment.refund.amount = refund.amount;
    payment.refund.status = refund.amount >= (payment.amount || 0) ? 'full' : 'partial';
    payment.refund.refundId = refund.refundId;
    payment.refund.refundedAt = new Date();
    payment.refund.reason = refund.reason || null;
    await payment.save();
  }

  return refund;
};

const handleRefundFailed = async ({ refundEntity, payload }) => {
  if (refundEntity?.notes?.type && refundEntity.notes.type !== 'order_refund') {
    return { ignored: true };
  }
  const refund = await upsertRefundFromWebhook({
    refundEntity,
    eventName: 'refund.failed',
    orderId: refundEntity.order_id || null,
    paymentId: refundEntity.payment_id || null,
    payload
  });

  const settlement = refund.orderId ? await OrderSettlement.findOne({ orderId: refund.orderId }) : null;
  if (settlement) {
    settlement.cancellationDetails = settlement.cancellationDetails || {};
    settlement.cancellationDetails.refundStatus = 'failed';
    settlement.cancellationDetails.refundFailureReason = refund.failureReason || 'Refund failed';
    settlement.cancellationDetails.refundProcessedAt = new Date();
    await settlement.save();
  }

  return refund;
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const rawBody = typeof req.rawBody === 'string' && req.rawBody.length
      ? req.rawBody
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay webhook signature' });
    }

    const isValid = await verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid Razorpay webhook signature' });
    }

    const body = safeJsonParse(req.body) || safeJsonParse(rawBody);
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }

    const { event, payload = {} } = body;
    if (!ALLOWED_EVENTS.has(event)) {
      return res.status(200).json({ success: true, ignored: true, event });
    }

    const paymentEntity = payload?.payment?.entity || null;
    const refundEntity = payload?.refund?.entity || null;

    if (event === 'payment.captured') {
      await handlePaymentCaptured({ paymentEntity });
    } else if (event === 'payment.failed') {
      await handlePaymentFailed({ paymentEntity });
    } else if (event === 'refund.created') {
      await handleRefundCreated({ refundEntity, payload });
    } else if (event === 'refund.processed') {
      await handleRefundProcessed({ refundEntity, payload });
    } else if (event === 'refund.failed') {
      await handleRefundFailed({ refundEntity, payload });
    }

    return res.status(200).json({ success: true, received: true, event });
  } catch (error) {
    console.error('[RAZORPAY_WEBHOOK] Handler error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process webhook'
    });
  }
};
