import Order from '../../order/models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Refund from '../models/Refund.js';
import { createRefund as createRazorpayRefund } from '../../payment/services/razorpayService.js';
const refundDebug = () => {};

const toRupees = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : 0;
};

const fromPaise = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount) / 100) : 0;
};

const toPaise = (value) => Math.max(0, Math.round(Number(value || 0) * 100));

const normalizeAmountInput = (amount) => {
  if (amount === null || amount === undefined || amount === '') {
    return null;
  }

  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const resolvePaymentContext = async ({ paymentId, orderId, razorpayOrderId }) => {
  refundDebug('resolve_payment_context_start', {
    paymentId: paymentId || null,
    orderId: orderId || null,
    razorpayOrderId: razorpayOrderId || null
  });
  let payment = null;

  if (paymentId) {
    payment = await Payment.findOne({
      'razorpay.paymentId': paymentId
    }).lean();
  }

  if (!payment && orderId) {
    payment = await Payment.findOne({ orderId }).lean();
  }

  if (!payment && razorpayOrderId) {
    payment = await Payment.findOne({
      'razorpay.orderId': razorpayOrderId
    }).lean();
  }

  if (!payment && paymentId) {
    const orderQuery = {
      'payment.razorpayPaymentId': paymentId
    };

    if (razorpayOrderId) {
      orderQuery.$or = [
        { 'payment.razorpayPaymentId': paymentId },
        { 'payment.razorpayOrderId': razorpayOrderId }
      ];
    }

    const order = await Order.findOne(orderQuery).lean();
    if (order) {
      payment = await Payment.findOne({
        orderId: order._id
      }).lean();
    }
  }

  refundDebug('resolve_payment_context_end', {
    paymentFound: Boolean(payment),
    paymentOrderId: payment?.orderId || null,
    paymentRazorpayPaymentId: payment?.razorpay?.paymentId || null
  });
  return payment;
};

const findDuplicateRefund = async ({ paymentId, orderId, amount, reason }) => {
  if (!paymentId) {
    return null;
  }

  const query = {
    paymentId,
    status: {
      $in: ['pending', 'success']
    }
  };

  if (orderId) {
    query.orderId = orderId;
  }

  if (amount !== null && amount !== undefined) {
    query.amount = toRupees(amount);
  }

  if (reason) {
    query.reason = reason;
  }

  return Refund.findOne(query).sort({ createdAt: -1 }).lean();
};

const buildRefundRecordPayload = ({
  payment,
  orderId,
  paymentId,
  refundId,
  amount,
  currency,
  razorpayOrderId,
  reason,
  notes,
  gatewayResponse
}) => ({
  refundId,
  orderId,
  paymentId,
  razorpayOrderId: razorpayOrderId || payment?.razorpay?.orderId || null,
  amount: toRupees(amount),
  currency: currency || payment?.currency || 'INR',
  status: 'pending',
  reason: reason || null,
  notes: notes || null,
  gatewayResponse: gatewayResponse || null,
  initiatedAt: new Date()
});

export const refundPayment = async (paymentId, amount = null, options = {}) => {
  if (!paymentId) {
    throw new Error('paymentId is required');
  }

  const payment = await resolvePaymentContext({
    paymentId,
    orderId: options.orderId || null,
    razorpayOrderId: options.razorpayOrderId || null
  });

  if (!payment && !options.orderId) {
    throw new Error('Unable to resolve payment context for refund');
  }

  const resolvedOrderId = options.orderId || payment?.orderId || null;
  const resolvedOrder = resolvedOrderId
    ? await Order.findById(resolvedOrderId).lean()
    : null;

  const requestedAmount = normalizeAmountInput(amount);
  const refundAmount = requestedAmount === null
    ? toRupees(payment?.amount || resolvedOrder?.pricing?.total || 0)
    : requestedAmount;

  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error('Refund amount must be greater than 0');
  }

  const duplicateRefund = await findDuplicateRefund({
    paymentId,
    orderId: resolvedOrder?._id || payment?.orderId || options.orderId || null,
    amount: refundAmount,
    reason: options.reason || null
  });

  if (duplicateRefund) {
    refundDebug('duplicate_refund_found', {
      paymentId,
      orderId: duplicateRefund.orderId || null,
      refundId: duplicateRefund.refundId || null,
      status: duplicateRefund.status || null,
      amount: duplicateRefund.amount || null
    });
    return {
      refund: duplicateRefund,
      razorpayRefund: duplicateRefund.gatewayResponse || null,
      refundId: duplicateRefund.refundId,
      amount: duplicateRefund.amount,
      alreadyProcessed: duplicateRefund.status === 'success'
    };
  }

  const refundNotes = {
    ...(options.notes || {}),
    orderId: resolvedOrder?.orderId || options.orderNumber || resolvedOrderId?.toString?.() || null,
    paymentId,
    reason: options.reason || null
  };

  const amountInPaise = requestedAmount === null ? null : toPaise(requestedAmount);
  refundDebug('create_razorpay_refund_request', {
    paymentId,
    orderId: resolvedOrder?._id || payment?.orderId || options.orderId || null,
    amount: refundAmount,
    amountInPaise,
    reason: options.reason || null
  });
  const razorpayRefund = await createRazorpayRefund(paymentId, amountInPaise, refundNotes);
  refundDebug('create_razorpay_refund_response', {
    paymentId,
    refundId: razorpayRefund?.id || null,
    status: razorpayRefund?.status || null,
    amount: razorpayRefund?.amount || null
  });

  const refundPayload = buildRefundRecordPayload({
    payment,
    orderId: resolvedOrder?._id || payment?.orderId || options.orderId || null,
    paymentId,
    refundId: razorpayRefund.id,
    amount: refundAmount,
    currency: payment?.currency || 'INR',
    razorpayOrderId: payment?.razorpay?.orderId || options.razorpayOrderId || null,
    reason: options.reason || null,
    notes: refundNotes,
    gatewayResponse: razorpayRefund
  });

  const refund = await Refund.findOneAndUpdate(
    { refundId: razorpayRefund.id },
    {
      $set: refundPayload,
      $setOnInsert: {
        webhookEventHistory: []
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  if (payment) {
    await Payment.findOneAndUpdate(
      { _id: payment._id },
      {
        $set: {
          refund: {
            ...(payment.refund || {}),
            amount: refund.amount,
            status: 'pending',
            refundId: refund.refundId,
            refundedAt: null,
            reason: refund.reason || null
          }
        }
      }
    );
    refundDebug('payment_refund_snapshot_updated', {
      paymentId,
      orderId: resolvedOrder?._id || payment?.orderId || options.orderId || null,
      refundId: refund.refundId,
      status: 'pending'
    });
  }

  return {
    refund,
    razorpayRefund,
    refundId: refund.refundId,
    amount: refund.amount
  };
};

export const upsertRefundFromWebhook = async ({ refundEntity, eventName, orderId = null, paymentId = null, payload = null }) => {
  if (!refundEntity?.id) {
    throw new Error('refundEntity.id is required');
  }
  refundDebug('webhook_refund_upsert_start', {
    eventName,
    refundId: refundEntity.id,
    paymentId: refundEntity.payment_id || paymentId || null,
    orderId: orderId || null
  });

  const paymentContext = await resolvePaymentContext({
    paymentId: refundEntity.payment_id || paymentId || null,
    orderId: orderId || null,
    razorpayOrderId: refundEntity.order_id || null
  });

  const resolvedOrderId = orderId || paymentContext?.orderId || null;
  const resolvedOrder = resolvedOrderId
    ? await Order.findById(resolvedOrderId).lean()
    : null;

  const status = eventName === 'refund.processed'
    ? 'success'
    : eventName === 'refund.failed'
      ? 'failed'
      : 'pending';

  const amount = refundEntity.amount !== undefined && refundEntity.amount !== null
    ? fromPaise(refundEntity.amount)
    : toRupees(paymentContext?.amount || resolvedOrder?.pricing?.total || 0);

  const update = {
    refundId: refundEntity.id,
    orderId: resolvedOrder?._id || paymentContext?.orderId || resolvedOrderId,
    paymentId: refundEntity.payment_id || paymentId || paymentContext?.razorpay?.paymentId || '',
    razorpayOrderId: refundEntity.order_id || paymentContext?.razorpay?.orderId || null,
    amount,
    currency: refundEntity.currency || paymentContext?.currency || 'INR',
    status,
    reason: refundEntity.notes?.reason || null,
    notes: refundEntity.notes || null,
    gatewayResponse: refundEntity,
    processedAt: eventName === 'refund.processed' ? new Date() : null,
    failedAt: eventName === 'refund.failed' ? new Date() : null,
    failureReason: eventName === 'refund.failed' ? refundEntity.error_description || refundEntity.short_url || null : null
  };

  const refund = await Refund.findOneAndUpdate(
    { refundId: refundEntity.id },
    {
      $set: update,
      $push: {
        webhookEventHistory: {
          event: eventName,
          receivedAt: new Date(),
          payload
        }
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  refundDebug('webhook_refund_upsert_done', {
    eventName,
    refundId: refund.refundId || null,
    paymentId: refund.paymentId || null,
    orderId: refund.orderId || null,
    status: refund.status || null,
    amount: refund.amount || null
  });
  return refund;
};

export const findRefundByRefundId = async (refundId) => {
  if (!refundId) return null;
  return Refund.findOne({ refundId }).lean();
};

export const findRefundByPaymentId = async (paymentId) => {
  if (!paymentId) return null;
  return Refund.findOne({ paymentId }).sort({ createdAt: -1 }).lean();
};
