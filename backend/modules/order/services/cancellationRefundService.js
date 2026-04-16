import mongoose from 'mongoose';
import Order from '../models/Order.js';
import OrderSettlement from '../models/OrderSettlement.js';
import UserWallet from '../../user/models/UserWallet.js';
import RestaurantWallet from '../../restaurant/models/RestaurantWallet.js';
import AdminWallet from '../../admin/models/AdminWallet.js';
import AuditLog from '../../admin/models/AuditLog.js';
import Payment from '../../payment/models/Payment.js';
import { refundPayment } from '../../refund/services/refundService.js';
import { calculateOrderSettlement } from './orderSettlementService.js';

const roundCurrency = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const normalizeText = value => String(value || '').toLowerCase().trim();
const refundDebug = () => {};

/**
 * Determine cancellation stage based on order status
 */
const getCancellationStage = order => {
  const tracking = order?.tracking || {};
  if (!tracking.confirmed?.status) {
    return 'pre_accept';
  }
  if (!tracking.preparing?.status) {
    return 'post_accept_pre_cook';
  }
  if (!tracking.ready?.status) {
    return 'post_cook';
  }
  return 'post_pickup';
};

const hasDeliveryAccepted = order => {
  const deliveryState = order?.deliveryState || {};
  const status = normalizeText(deliveryState.status);
  const phase = normalizeText(deliveryState.currentPhase);
  return (
    status === 'accepted' ||
    status === 'order_confirmed' ||
    status === 'reached_pickup' ||
    status === 'en_route_to_delivery' ||
    phase === 'en_route_to_pickup' ||
    phase === 'at_pickup' ||
    phase === 'en_route_to_delivery' ||
    phase === 'picked_up' ||
    phase === 'at_delivery' ||
    phase === 'completed' ||
    order?.status === 'out_for_delivery'
  );
};

export const getRazorpayRefundPolicy = (order, { trigger = 'user', reason = '' } = {}) => {
  const orderStatus = normalizeText(order?.status);
  const tracking = order?.tracking || {};
  const isReady = Boolean(tracking.ready?.status) || orderStatus === 'ready';
  const isPreparing = Boolean(tracking.preparing?.status) || orderStatus === 'preparing';
  const isConfirmed = Boolean(tracking.confirmed?.status) || orderStatus === 'confirmed';
  const isOutForDelivery = Boolean(tracking.outForDelivery?.status) || orderStatus === 'out_for_delivery' || hasDeliveryAccepted(order);
  const isRejected = trigger === 'restaurant' || normalizeText(reason).includes('reject');

  refundDebug('policy_evaluated', {
    orderId: order?.orderId || order?._id?.toString?.() || null,
    status: orderStatus,
    trigger,
    stage: getCancellationStage(order),
    isPreparing,
    isReady,
    isOutForDelivery,
    isRejected
  });

  if (!order || orderStatus === 'delivered' || orderStatus === 'refunded') {
    return {
      eligible: false,
      refundPercent: 0,
      refundAmount: 0,
      stage: orderStatus || 'unknown',
      reason: 'Order is not refundable in current state'
    };
  }

  if (isRejected) {
    return {
      eligible: true,
      refundPercent: 100,
      refundAmount: roundCurrency(order?.pricing?.total || 0),
      stage: 'restaurant_rejected',
      reason: 'Restaurant rejected order'
    };
  }

  if (isOutForDelivery || isReady) {
    return {
      eligible: false,
      refundPercent: 0,
      refundAmount: 0,
      stage: isOutForDelivery ? 'out_for_delivery' : 'ready',
      reason: isOutForDelivery ? 'Order is already out for delivery' : 'Preparation complete'
    };
  }

  if (isPreparing) {
    return {
      eligible: true,
      refundPercent: 50,
      refundAmount: roundCurrency((order?.pricing?.total || 0) * 0.5),
      stage: 'preparing',
      reason: 'Restaurant started preparing the order'
    };
  }

  if (isConfirmed) {
    return {
      eligible: true,
      refundPercent: 100,
      refundAmount: roundCurrency(order?.pricing?.total || 0),
      stage: 'confirmed',
      reason: 'Order not yet prepared'
    };
  }

  return {
    eligible: true,
    refundPercent: 100,
    refundAmount: roundCurrency(order?.pricing?.total || 0),
    stage: 'pending',
    reason: 'Order not yet accepted'
  };
};

const persistRefundIntent = async ({ order, payment, policy, source, reason }) => {
  const now = new Date();
  refundDebug('refund_intent_persist_start', {
    orderId: order?.orderId || order?._id?.toString?.() || null,
    paymentId: payment?.razorpay?.paymentId || null,
    source,
    refundPercent: policy.refundPercent,
    refundAmount: policy.refundAmount
  });
  const refundMeta = {
    ...(payment?.refund || {}),
    amount: policy.refundAmount,
    status: 'pending',
    refundId: payment?.refund?.refundId || null,
    refundedAt: null,
    reason: reason || policy.reason || null
  };

  if (payment) {
    payment.refund = refundMeta;
    payment.logs = payment.logs || [];
    payment.logs.push({
      action: 'processing',
      timestamp: now,
      details: {
        source,
        refundPercent: policy.refundPercent,
        refundAmount: policy.refundAmount,
        stage: policy.stage,
        note: 'Refund intent stored; awaiting gateway capture or refund initiation'
      }
    });
    await payment.save();
    refundDebug('refund_intent_persisted', {
      orderId: order?.orderId || order?._id?.toString?.() || null,
      paymentId: payment?.razorpay?.paymentId || null,
      refundStatus: payment?.refund?.status || 'pending'
    });
  }

  return {
    refundAmount: policy.refundAmount,
    refundPercent: policy.refundPercent,
    source,
    status: 'pending',
    reason: reason || policy.reason || null
  };
};

export const initiateRazorpayRefundForOrder = async ({ orderId, trigger = 'user', reason = '', adminId = null }) => {
  refundDebug('refund_flow_start', { orderId, trigger, reason });
  const order = await Order.findById(orderId);
  if (!order) {
    refundDebug('refund_flow_order_missing', { orderId, trigger });
    throw new Error('Order not found');
  }

  const policy = getRazorpayRefundPolicy(order, { trigger, reason });
  let payment = await Payment.findOne({ orderId: order._id }).sort({ createdAt: -1 });
  refundDebug('refund_flow_payment_lookup', {
    orderId: order.orderId || order._id?.toString?.(),
    paymentId: payment?.razorpay?.paymentId || null,
    paymentStatus: payment?.status || null,
    policy
  });

  if (!policy.eligible || policy.refundAmount <= 0) {
    refundDebug('refund_flow_skipped', {
      orderId: order.orderId || order._id?.toString?.(),
      reason: policy.reason,
      stage: policy.stage
    });
    return {
      order,
      payment,
      policy,
      refundInitiated: false,
      refundSkipped: true
    };
  }

  const paymentId = payment?.razorpay?.paymentId || order.payment?.razorpayPaymentId || null;
  const paymentCapturedFromStatus =
    normalizeText(payment?.status) === 'success' ||
    normalizeText(payment?.status) === 'completed' ||
    normalizeText(order?.payment?.status) === 'completed';
  const paymentCapturedFromGateway =
    Boolean(payment?.gatewayResponse?.captured) ||
    normalizeText(payment?.gatewayResponse?.status) === 'captured' ||
    normalizeText(payment?.gatewayResponse?.entity?.status) === 'captured';
  const paymentCaptured = paymentCapturedFromStatus || paymentCapturedFromGateway;
  refundDebug('refund_flow_capture_check', {
    orderId: order.orderId || order._id?.toString?.(),
    paymentId,
    paymentCaptured,
    paymentCapturedFromStatus,
    paymentCapturedFromGateway
  });

  if (!payment || !paymentId || !paymentCaptured) {
    const intent = await persistRefundIntent({
      order,
      payment,
      policy,
      source: trigger,
      reason
    });

    return {
      order,
      payment,
      policy,
      refundInitiated: false,
      refundQueued: true,
      refundIntent: intent
    };
  }

  if (payment.refund?.status === 'pending' || payment.refund?.status === 'success' || payment.refund?.status === 'failed') {
    if (payment.refund?.status === 'success') {
      refundDebug('refund_flow_already_success', {
        orderId: order.orderId || order._id?.toString?.(),
        paymentId,
        refundId: payment.refund?.refundId || null
      });
      return {
        order,
        payment,
        policy,
        refundInitiated: true,
        alreadyProcessed: true
      };
    }
  }

  refundDebug('refund_gateway_request', {
    orderId: order.orderId || order._id?.toString?.(),
    paymentId,
    refundAmount: policy.refundAmount,
    refundPercent: policy.refundPercent,
    trigger,
    adminId
  });
  const refundResult = await refundPayment(paymentId, policy.refundAmount, {
    orderId: order._id,
    orderNumber: order.orderId,
    reason: reason || policy.reason || 'Refund requested by cancellation/rejection policy',
    notes: {
      orderId: order.orderId,
      source: trigger,
      refundPercent: String(policy.refundPercent),
      stage: policy.stage,
      adminId: adminId || 'system'
    }
  });

  const refreshedPayment = await Payment.findById(payment._id);
  if (refreshedPayment) {
    refreshedPayment.refund = {
      ...(refreshedPayment.refund || {}),
      amount: policy.refundAmount,
      status: 'pending',
      refundId: refundResult.refundId || refreshedPayment.refund?.refundId || null,
      refundedAt: null,
      reason: reason || policy.reason || null
    };
    await refreshedPayment.save();
    payment = refreshedPayment;
    refundDebug('refund_payment_updated', {
      orderId: order.orderId || order._id?.toString?.(),
      paymentId,
      refundId: refundResult.refundId || refreshedPayment.refund?.refundId || null,
      refundStatus: refreshedPayment.refund?.status || 'pending'
    });
  }

  refundDebug('refund_flow_initiated', {
    orderId: order.orderId || order._id?.toString?.(),
    paymentId,
    refundId: refundResult.refundId || null,
    refundAmount: policy.refundAmount
  });
  return {
    order,
    payment,
    policy,
    refundInitiated: true,
    refundId: refundResult.refundId,
    razorpayRefund: refundResult.razorpayRefund,
    refundAmount: policy.refundAmount
  };
};

const buildCancellationRefundBreakdown = (order, settlement = null) => {
  const cancellationStage = getCancellationStage(order);
  const userPayment = settlement?.userPayment || {
    subtotal: roundCurrency(order?.pricing?.subtotal || 0),
    discount: roundCurrency(order?.pricing?.discount || 0),
    deliveryFee: roundCurrency(order?.pricing?.deliveryFee || 0),
    platformFee: roundCurrency(order?.pricing?.platformFee || 0),
    total: roundCurrency(order?.pricing?.total || 0)
  };

  let refundAmount = 0;
  let restaurantCompensation = 0;

  switch (cancellationStage) {
    case 'pre_accept':
      refundAmount = userPayment.total;
      break;
    case 'post_accept_pre_cook':
      refundAmount = roundCurrency((userPayment.subtotal || 0) - (userPayment.discount || 0) + (userPayment.deliveryFee || 0));
      break;
    case 'post_cook':
      restaurantCompensation = roundCurrency(settlement?.restaurantEarning?.netEarning || 0);
      refundAmount = roundCurrency((userPayment.deliveryFee || 0) + ((userPayment.platformFee || 0) * 0.5));
      break;
    case 'post_pickup':
      restaurantCompensation = roundCurrency(settlement?.restaurantEarning?.netEarning || 0);
      break;
    default:
      break;
  }

  return {
    cancellationStage,
    userPayment,
    refundAmount: roundCurrency(refundAmount),
    restaurantCompensation: roundCurrency(restaurantCompensation)
  };
};

const updateSettlementCancellationDetails = async (settlement, breakdown, cancellationReason) => {
  if (!settlement) {
    return null;
  }

  settlement.cancellationDetails = {
    ...(settlement.cancellationDetails || {}),
    cancelled: true,
    cancelledAt: new Date(),
    cancellationStage: breakdown.cancellationStage,
    refundAmount: breakdown.refundAmount,
    restaurantCompensation: breakdown.restaurantCompensation,
    refundStatus: settlement.cancellationDetails?.refundStatus || 'pending',
    cancellationReason: cancellationReason || settlement.cancellationDetails?.cancellationReason || null
  };

  settlement.escrowStatus = 'refunded';
  settlement.settlementStatus = 'cancelled';
  if (settlement.restaurantEarning) {
    settlement.restaurantEarning.status = 'cancelled';
  }
  if (settlement.deliveryPartnerEarning) {
    settlement.deliveryPartnerEarning.status = 'cancelled';
  }
  if (settlement.adminEarning) {
    settlement.adminEarning.status = 'cancelled';
  }

  await settlement.save();
  return settlement;
};

/**
 * Calculate cancellation refund amount without processing.
 */
export const calculateCancellationRefund = async (orderId, cancellationReason) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status !== 'cancelled') {
      throw new Error('Order is not cancelled');
    }
    const settlement = await OrderSettlement.findOne({ orderId });
    const breakdown = buildCancellationRefundBreakdown(order, settlement);
    await updateSettlementCancellationDetails(settlement, breakdown, cancellationReason);

    await AuditLog.createLog({
      entityType: 'order',
      entityId: orderId,
      action: 'cancellation_refund_calculated',
      actionType: 'refund',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: breakdown.refundAmount,
        type: 'refund',
        status: 'pending',
        orderId: orderId
      },
      description: `Cancellation refund calculated for order ${settlement?.orderNumber || order.orderId}. Stage: ${breakdown.cancellationStage}, Refund: ₹${breakdown.refundAmount}, Restaurant Compensation: ₹${breakdown.restaurantCompensation}. Awaiting refund initiation or webhook confirmation.`
    });
    return {
      cancellationStage: breakdown.cancellationStage,
      refundAmount: breakdown.refundAmount,
      restaurantCompensation: breakdown.restaurantCompensation,
      settlement: settlement || null,
      settlementAvailable: !!settlement
    };
  } catch (error) {
    console.error('Error calculating cancellation refund:', error);
    throw new Error(`Failed to calculate cancellation refund: ${error.message}`);
  }
};

/**
 * Process cancellation refund based on cancellation stage
 */
export const processCancellationRefund = async (orderId, cancellationReason) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status !== 'cancelled') {
      throw new Error('Order is not cancelled');
    }
    const settlement = await OrderSettlement.findOne({ orderId });
    const breakdown = buildCancellationRefundBreakdown(order, settlement);
    await updateSettlementCancellationDetails(settlement, breakdown, cancellationReason);

    // Process refund to user
    if (breakdown.refundAmount > 0) {
      await refundToUser(order.userId, orderId, breakdown.refundAmount, settlement?.orderNumber || order.orderId, cancellationReason);
      if (settlement?.cancellationDetails) {
        settlement.cancellationDetails.refundStatus = 'processed';
      }
    }

    // Compensate restaurant if applicable
    if (breakdown.restaurantCompensation > 0 && settlement?.restaurantId) {
      await compensateRestaurant(settlement.restaurantId, orderId, breakdown.restaurantCompensation, settlement.orderNumber);
    }

    // Reverse admin earnings (if needed)
    if (settlement && (breakdown.cancellationStage === 'pre_accept' || breakdown.cancellationStage === 'post_accept_pre_cook')) {
      await reverseAdminEarnings(orderId, settlement.adminEarning, settlement.orderNumber);
    }
    if (settlement) {
      await settlement.save();
    }

    // Create audit log
    await AuditLog.createLog({
      entityType: 'order',
      entityId: orderId,
      action: 'cancellation_refund',
      actionType: 'refund',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: breakdown.refundAmount,
        type: 'refund',
        status: 'success',
        orderId: orderId
      },
      description: `Cancellation refund processed for order ${settlement?.orderNumber || order.orderId}. Stage: ${breakdown.cancellationStage}, Refund: ₹${breakdown.refundAmount}, Restaurant Compensation: ₹${breakdown.restaurantCompensation}`
    });
    return {
      cancellationStage: breakdown.cancellationStage,
      refundAmount: breakdown.refundAmount,
      restaurantCompensation: breakdown.restaurantCompensation,
      settlement: settlement || null,
      settlementAvailable: !!settlement
    };
  } catch (error) {
    console.error('Error processing cancellation refund:', error);
    throw new Error(`Failed to process cancellation refund: ${error.message}`);
  }
};

/**
 * Refund amount to user wallet
 */
const refundToUser = async (userId, orderId, amount, orderNumber, reason) => {
  try {
    const wallet = await UserWallet.findOrCreateByUserId(userId);
    wallet.addTransaction({
      amount: amount,
      type: 'refund',
      status: 'Completed',
      description: `Refund for cancelled order ${orderNumber}. Reason: ${reason}`,
      orderId: orderId
    });
    await wallet.save();

    // Create audit log
    await AuditLog.createLog({
      entityType: 'user',
      entityId: userId,
      action: 'refund_credit',
      actionType: 'refund',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: amount,
        type: 'refund',
        status: 'success',
        orderId: orderId,
        walletType: 'user'
      },
      description: `User refunded for cancelled order ${orderNumber}`
    });
  } catch (error) {
    console.error('Error refunding to user:', error);
    throw error;
  }
};

/**
 * Compensate restaurant for cancelled order
 */
const compensateRestaurant = async (restaurantId, orderId, amount, orderNumber) => {
  try {
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(restaurantId);
    wallet.addTransaction({
      amount: amount,
      type: 'payment',
      status: 'Completed',
      description: `Compensation for cancelled order ${orderNumber}`,
      orderId: orderId
    });
    await wallet.save();

    // Create audit log
    await AuditLog.createLog({
      entityType: 'restaurant',
      entityId: restaurantId,
      action: 'cancellation_compensation',
      actionType: 'credit',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: amount,
        type: 'compensation',
        status: 'success',
        orderId: orderId,
        walletType: 'restaurant'
      },
      description: `Restaurant compensated for cancelled order ${orderNumber}`
    });
  } catch (error) {
    console.error('Error compensating restaurant:', error);
    throw error;
  }
};

/**
 * Reverse admin earnings for cancelled orders
 */
const reverseAdminEarnings = async (orderId, adminEarning, orderNumber) => {
  try {
    const wallet = await AdminWallet.findOrCreate();

    // Reverse commission
    if (adminEarning.commission > 0) {
      wallet.addTransaction({
        amount: -adminEarning.commission,
        type: 'deduction',
        status: 'Completed',
        description: `Commission reversal for cancelled order ${orderNumber}`,
        orderId: orderId
      });
    }

    // Reverse platform fee
    if (adminEarning.platformFee > 0) {
      wallet.addTransaction({
        amount: -adminEarning.platformFee,
        type: 'deduction',
        status: 'Completed',
        description: `Platform fee reversal for cancelled order ${orderNumber}`,
        orderId: orderId
      });
    }

    // Reverse delivery fee
    if (adminEarning.deliveryFee > 0) {
      wallet.addTransaction({
        amount: -adminEarning.deliveryFee,
        type: 'deduction',
        status: 'Completed',
        description: `Delivery fee reversal for cancelled order ${orderNumber}`,
        orderId: orderId
      });
    }

    // Reverse GST
    if (adminEarning.gst > 0) {
      wallet.addTransaction({
        amount: -adminEarning.gst,
        type: 'deduction',
        status: 'Completed',
        description: `GST reversal for cancelled order ${orderNumber}`,
        orderId: orderId
      });
    }
    await wallet.save();

    // Create audit log
    await AuditLog.createLog({
      entityType: 'order',
      entityId: orderId,
      action: 'admin_earning_reversal',
      actionType: 'deduction',
      performedBy: {
        type: 'system',
        name: 'System'
      },
      transactionDetails: {
        amount: adminEarning.totalEarning,
        type: 'reversal',
        status: 'success',
        orderId: orderId,
        walletType: 'admin'
      },
      description: `Admin earnings reversed for cancelled order ${orderNumber}`
    });
  } catch (error) {
    console.error('Error reversing admin earnings:', error);
    throw error;
  }
};

/**
 * Process Razorpay refund for cancelled order (called by admin)
 * @param {String} orderId - Order ID
 * @param {String} adminId - Admin user ID who initiated the refund
 * @returns {Promise<Object>} Refund result
 */
export const processRazorpayRefund = async (orderId, adminId = null) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status !== 'cancelled') {
      throw new Error('Order is not cancelled');
    }

    // Check if payment method is Razorpay (online payment)
    if (order.payment.method !== 'razorpay' && order.payment.method !== 'upi' && order.payment.method !== 'card') {
      throw new Error('Refund can only be processed for online payments (Razorpay). COD orders cannot be refunded via Razorpay.');
    }

    // Check if Razorpay payment ID exists
    if (!order.payment.razorpayPaymentId) {
      throw new Error('Razorpay payment ID not found for this order');
    }
    const settlement = await OrderSettlement.findOne({ orderId });

    // Check if refund already processed when settlement exists
    if (settlement?.cancellationDetails?.refundStatus === 'processed' || settlement?.cancellationDetails?.refundStatus === 'initiated') {
      throw new Error('Refund already processed or initiated for this order');
    }

    const breakdown = buildCancellationRefundBreakdown(order, settlement);
    const refundAmount = settlement?.cancellationDetails?.refundAmount || breakdown.refundAmount || 0;
    if (refundAmount <= 0) {
      throw new Error('No refund amount calculated for this order');
    }

    // Update settlement with initiation status when it exists
    if (settlement) {
      settlement.cancellationDetails = {
        ...(settlement.cancellationDetails || {}),
        cancelled: true,
        cancelledAt: settlement.cancellationDetails?.cancelledAt || new Date(),
        cancellationStage: settlement.cancellationDetails?.cancellationStage || breakdown.cancellationStage,
        refundAmount,
        restaurantCompensation: settlement.cancellationDetails?.restaurantCompensation || breakdown.restaurantCompensation,
        refundStatus: 'initiated',
        refundInitiatedAt: new Date()
      };
      if (adminId) {
        settlement.cancellationDetails.refundInitiatedBy = adminId;
      }
      await settlement.save();
    }

    // Create Razorpay refund
    let razorpayRefund = null;
    try {
      const refundResult = await refundPayment(order.payment.razorpayPaymentId, refundAmount, {
        orderId: order._id,
        orderNumber: order.orderId,
        reason: order.cancellationReason || 'Order cancelled by restaurant',
        notes: {
          orderId: order.orderId,
          type: 'order_refund',
          cancelledBy: 'restaurant',
          adminId: adminId || 'system'
        }
      });
      razorpayRefund = refundResult.razorpayRefund;
    } catch (razorpayError) {
      if (settlement) {
        settlement.cancellationDetails = {
          ...(settlement.cancellationDetails || {}),
          refundStatus: 'failed',
          refundFailureReason: razorpayError.message
        };
        await settlement.save();
      }
      throw new Error(`Failed to create Razorpay refund: ${razorpayError.message}`);
    }

    if (settlement) {
      settlement.cancellationDetails = {
        ...(settlement.cancellationDetails || {}),
        razorpayRefundId: razorpayRefund.id,
        refundStatus: 'initiated'
      };
      await settlement.save();
    }

    // Compensate restaurant if applicable
    const restaurantCompensation = settlement?.cancellationDetails?.restaurantCompensation || breakdown.restaurantCompensation || 0;
    if (restaurantCompensation > 0 && settlement?.restaurantId) {
      await compensateRestaurant(settlement.restaurantId, orderId, restaurantCompensation, settlement.orderNumber);
    }

    // Reverse admin earnings (if needed)
    const cancellationStage = settlement?.cancellationDetails?.cancellationStage || breakdown.cancellationStage;
    if (settlement && (cancellationStage === 'pre_accept' || cancellationStage === 'post_accept_pre_cook')) {
      await reverseAdminEarnings(orderId, settlement.adminEarning, settlement.orderNumber);
    }

    // Create audit log
    await AuditLog.createLog({
      entityType: 'order',
      entityId: orderId,
      action: 'razorpay_refund_initiated',
      actionType: 'refund',
      performedBy: {
        type: adminId ? 'admin' : 'system',
        id: adminId || null,
        name: adminId ? 'Admin' : 'System'
      },
      transactionDetails: {
        amount: refundAmount,
        type: 'razorpay_refund',
        status: 'initiated',
        orderId: orderId,
        razorpayRefundId: razorpayRefund.id,
        razorpayPaymentId: order.payment.razorpayPaymentId
      },
      description: `Razorpay refund initiated for order ${settlement?.orderNumber || order.orderId}. Refund ID: ${razorpayRefund.id}, Amount: ₹${refundAmount}`
    });
    return {
      success: true,
      refundId: razorpayRefund.id,
      refundAmount: refundAmount,
      razorpayRefund: razorpayRefund,
      message: `Refund of ₹${refundAmount} initiated successfully. Amount will be credited to customer's account within 3-5 working days.`
    };
  } catch (error) {
    console.error('Error processing Razorpay refund:', error);
    throw error;
  }
};

/**
 * Process wallet refund for cancelled order
 * Adds refund amount directly to user wallet
 * 
 * IMPORTANT: Wallet payments do NOT use Razorpay. This function:
 * - Directly credits the refund amount to user's wallet
 * - Does NOT require Razorpay payment ID or keys
 * - Does NOT call Razorpay API
 * - Is instant (no external payment gateway involved)
 * 
 * @param {String} orderId - Order ID
 * @param {String} adminId - Admin user ID who initiated the refund
 * @param {Number} refundAmount - Optional refund amount (if not provided, uses order total)
 * @returns {Promise<Object>} Refund result
 */
export const processWalletRefund = async (orderId, adminId = null, refundAmount = null) => {
  try {
    // Try to find order by MongoDB _id first
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId).populate('userId', 'name email phone _id').lean();
    }

    // If not found, try by orderId string
    if (!order) {
      order = await Order.findOne({
        orderId: orderId
      }).populate('userId', 'name email phone _id').lean();
    }
    if (!order) {
      console.error('âŒ [processWalletRefund] Order not found:', orderId);
      throw new Error('Order not found');
    }
    if (order.status !== 'cancelled') {
      console.error('âŒ [processWalletRefund] Order is not cancelled:', order.status);
      throw new Error('Order is not cancelled');
    }

    // Check if payment method is wallet (wallet payments don't use Razorpay)
    if (order.payment?.method !== 'wallet') {
      console.error('âŒ [processWalletRefund] Payment method is not wallet:', order.payment?.method);
      throw new Error('This function can only process wallet refunds. Wallet payments do not use Razorpay.');
    }

    // Ensure no Razorpay payment ID exists (wallet payments are direct, no Razorpay involved)
    if (order.payment?.razorpayPaymentId) {
      console.warn('âš ï¸ [processWalletRefund] Warning: Wallet payment has Razorpay payment ID. This should not happen for wallet payments.');
      // Don't throw error, just log warning - proceed with wallet refund
    }

    // Get settlement (for wallet payments, settlement might not exist - create proper one if needed)
    let settlement = await OrderSettlement.findOne({
      orderId
    });
    if (!settlement) {
      await calculateOrderSettlement(order._id);
      settlement = await OrderSettlement.findOne({ orderId });
      if (!settlement) {
        throw new Error('Unable to create settlement for wallet refund');
      }
    }

    // Check if refund already processed
    if (settlement.cancellationDetails?.refundStatus === 'processed' || settlement.cancellationDetails?.refundStatus === 'initiated') {
      throw new Error('Refund already processed or initiated for this order');
    }

    // Determine refund amount: use provided amount, or calculate from order/settlement
    let finalRefundAmount = 0;
    if (refundAmount !== null && refundAmount !== undefined && refundAmount > 0) {
      // Use provided refund amount
      finalRefundAmount = parseFloat(refundAmount);
    } else {
      // Calculate refund amount from order or settlement
      const orderTotal = order.pricing?.total || settlement.userPayment?.total || 0;
      const calculatedRefund = settlement.cancellationDetails?.refundAmount || 0;

      // For wallet, use order total if calculated refund is 0
      if (calculatedRefund > 0) {
        finalRefundAmount = calculatedRefund;
      } else if (orderTotal > 0) {
        finalRefundAmount = orderTotal;
      } else {
        throw new Error('No refund amount found for this order');
      }
    }
    if (finalRefundAmount <= 0) {
      throw new Error('Invalid refund amount. Refund amount must be greater than 0');
    }

    // Update the variable name for consistency
    const refundAmountToProcess = finalRefundAmount;

    // Update refund status to 'initiated'
    settlement.cancellationDetails.refundStatus = 'initiated';
    settlement.cancellationDetails.refundInitiatedAt = new Date();
    if (adminId) {
      settlement.cancellationDetails.refundInitiatedBy = adminId;
    }
    await settlement.save();

    // Refund to user wallet - verify user exists first
    try {
      // Get user ID (handle both populated and non-populated)
      const userId = order.userId?._id || order.userId;
      if (!userId) {
        throw new Error('User ID not found in order');
      }
      const wallet = await UserWallet.findOrCreateByUserId(userId);
      // Check if refund already exists for this order (prevent duplicate)
      const existingRefund = wallet.transactions.find(t => t.orderId && t.orderId.toString() === order._id.toString() && t.type === 'refund');
      if (existingRefund) {} else {
        const transaction = wallet.addTransaction({
          amount: refundAmountToProcess,
          type: 'refund',
          status: 'Completed',
          description: `Refund for cancelled order ${settlement.orderNumber || order.orderId}. Reason: ${order.cancellationReason || 'Order cancelled'}`,
          orderId: order._id
        });

        // Get balance before save to verify it's being updated
        const balanceBeforeSave = wallet.balance;
        await wallet.save();

        // Reload wallet to verify balance was saved correctly
        const savedWallet = await UserWallet.findById(wallet._id);
        // Verify balance was actually updated
        if (savedWallet && savedWallet.balance !== balanceBeforeSave) {} else {
          console.error('âš ï¸ [processWalletRefund] WARNING: Balance may not have been updated correctly!', {
            balanceBeforeSave,
            balanceAfterSave: wallet.balance,
            savedWalletBalance: savedWallet?.balance
          });
        }

        // Update user's wallet balance in User model (for backward compatibility)
        const User = (await import('../../auth/models/User.js')).default;
        const userUpdateResult = await User.findByIdAndUpdate(userId, {
          'wallet.balance': savedWallet?.balance || wallet.balance,
          'wallet.currency': wallet.currency || 'INR'
        }, {
          new: true
        });
      }

      // Create audit log
      try {
        await AuditLog.createLog({
          entityType: 'user',
          entityId: order.userId?._id || order.userId,
          action: 'refund_credit',
          actionType: 'refund',
          performedBy: {
            type: adminId ? 'admin' : 'system',
            userId: adminId || null,
            name: adminId ? 'Admin' : 'System'
          },
          transactionDetails: {
            amount: refundAmountToProcess,
            currency: 'INR',
            type: 'refund',
            status: 'success',
            orderId: order._id,
            walletType: 'user'
          },
          description: `User refunded for cancelled order ${settlement.orderNumber || order.orderId}`
        });
      } catch (auditError) {
        console.error('âš ï¸ [processWalletRefund] Error creating audit log (non-critical):', auditError.message);
        // Don't throw - audit log failure shouldn't block refund
      }
    } catch (walletError) {
      console.error('âŒ Error refunding to user wallet:', walletError);
      throw new Error(`Failed to refund to user wallet: ${walletError.message}`);
    }

    // Update refund status to 'processed' (wallet refunds are instant)
    settlement.cancellationDetails.refundStatus = 'processed';
    settlement.cancellationDetails.refundProcessedAt = new Date();
    if (adminId) {
      settlement.cancellationDetails.refundProcessedBy = adminId;
    }
    await settlement.save();

    // Create audit log for order
    try {
      await AuditLog.createLog({
        entityType: 'order',
        entityId: order._id,
        action: 'wallet_refund_processed',
        actionType: 'refund',
        performedBy: {
          type: adminId ? 'admin' : 'system',
          userId: adminId || null,
          name: adminId ? 'Admin' : 'System'
        },
        transactionDetails: {
          amount: refundAmountToProcess,
          currency: 'INR',
          type: 'wallet_refund',
          status: 'success',
          orderId: order._id
        },
        description: `Wallet refund of â‚¹${refundAmountToProcess} processed for cancelled order ${settlement.orderNumber || order.orderId}`
      });
    } catch (auditError) {
      console.error('âš ï¸ [processWalletRefund] Error creating order audit log (non-critical):', auditError.message);
      // Don't throw - audit log failure shouldn't block refund
    }
    return {
      refundId: `wallet-${order._id}-${Date.now()}`,
      refundAmount: refundAmountToProcess,
      walletRefund: true,
      message: `Wallet refund of â‚¹${refundAmountToProcess} processed successfully. Amount has been credited to customer's wallet.`
    };
  } catch (error) {
    console.error('Error processing wallet refund:', error);
    throw error;
  }
};

