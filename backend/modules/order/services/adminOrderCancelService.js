import mongoose from 'mongoose';
import Order from '../models/Order.js';
import OrderSettlement from '../models/OrderSettlement.js';
import AuditLog from '../../admin/models/AuditLog.js';
import { clearAssignmentTimer } from './deliveryAssignmentService.js';
import { calculateOrderSettlement } from './orderSettlementService.js';
import { holdEscrow, releaseEscrow } from './escrowWalletService.js';
import { isEffectivelyOutForDelivery, syncOutForDeliveryStatusIfNeeded } from './orderStatusSyncService.js';

const ADMIN_CANCEL_STATUS = 'out_for_delivery';

const TERMINAL_STATUSES = new Set(['cancelled', 'delivered', 'refunded', 'failed']);

const isCodPayment = (order) => {
  const method = String(order?.payment?.method || '').toLowerCase();
  return method === 'cash' || method === 'cod';
};

const isPaymentEligibleForAdminCancel = (order) => {
  const paymentStatus = String(order?.payment?.status || '').toLowerCase();
  if (!paymentStatus || paymentStatus === 'completed') {
    return true;
  }
  // COD stays pending until delivery completes — allowed for food-on-the-way admin cancel.
  if (isCodPayment(order) && order?.status === ADMIN_CANCEL_STATUS) {
    return true;
  }
  return false;
};

/** Escrow is held, or was held then reset to pending by settlement recalc (e.g. rider assign). */
const isEscrowReadyForAdminCancel = (settlement) => {
  if (!settlement) return false;
  if (settlement.escrowStatus === 'held') return true;
  if (settlement.escrowStatus === 'pending' && Number(settlement.escrowAmount) > 0) {
    return true;
  }
  return false;
};

export const isAdminCancellableOrder = (order, settlement) => {
  if (!order || !isEffectivelyOutForDelivery(order)) {
    return false;
  }
  if (TERMINAL_STATUSES.has(order.status) || order.status === 'payment_pending') {
    return false;
  }
  if (!isPaymentEligibleForAdminCancel(order)) {
    return false;
  }
  return isEscrowReadyForAdminCancel(settlement);
};

const resolveOrder = async (orderId) => {
  if (mongoose.Types.ObjectId.isValid(orderId) && String(orderId).length === 24) {
    const byId = await Order.findById(orderId);
    if (byId) return byId;
  }
  return Order.findOne({ orderId: String(orderId) });
};

/** Restore held escrow when settlement recalc reset status to pending after initial holdEscrow. */
const ensureEscrowHeldForAdminCancel = async (order, settlement) => {
  if (settlement.escrowStatus === 'held') {
    return settlement;
  }

  if (settlement.escrowStatus !== 'pending' || !(Number(settlement.escrowAmount) > 0)) {
    const error = new Error(`Escrow is not held. Current status: ${settlement.escrowStatus || 'unknown'}`);
    error.statusCode = 400;
    throw error;
  }

  const amount = Number(settlement.escrowAmount) || Number(order.pricing?.total) || 0;
  const userId = order.userId?._id || order.userId;
  return holdEscrow(order._id, userId, amount);
};

const sendCancellationNotifications = async (order) => {
  const orderIdStr = order._id.toString();

  try {
    const { notifyRestaurantOrderUpdate } = await import('./restaurantNotificationService.js');
    await notifyRestaurantOrderUpdate(orderIdStr, 'cancelled');
  } catch (error) {
    console.error('Admin cancel: restaurant notification failed:', error.message);
  }

  try {
    const { notifyUserOrderUpdate } = await import('./userNotificationService.js');
    if (notifyUserOrderUpdate) {
      await notifyUserOrderUpdate(orderIdStr, 'cancelled');
    }
  } catch (error) {
    console.error('Admin cancel: user notification failed:', error.message);
  }

  try {
    const assignedDeliveryId = order.deliveryPartnerId?._id?.toString?.()
      || order.deliveryPartnerId?.toString?.()
      || order.deliveryPartnerId;
    const { notifyDeliveryPartnerOrderCancelled } = await import('./deliveryNotificationService.js');
    await notifyDeliveryPartnerOrderCancelled(assignedDeliveryId, order);
  } catch (error) {
    console.error('Admin cancel: delivery notification failed:', error.message);
  }
};

/**
 * Admin-only cancel: releases escrow first, then marks order cancelled (food-on-the-way only).
 */
export const adminCancelOrderWithSettlement = async ({ orderId, reason, adminId = null }) => {
  if (!reason || !String(reason).trim()) {
    const error = new Error('Cancellation reason is required');
    error.statusCode = 400;
    throw error;
  }

  let order = await resolveOrder(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  const syncedOrder = await syncOutForDeliveryStatusIfNeeded(order);
  if (syncedOrder) {
    order = await Order.findById(order._id);
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }
  }

  if (order.status === 'cancelled') {
    const error = new Error('Order is already cancelled');
    error.statusCode = 400;
    throw error;
  }

  if (order.status === 'delivered') {
    const error = new Error('Cannot cancel a delivered order');
    error.statusCode = 409;
    throw error;
  }

  if (TERMINAL_STATUSES.has(order.status)) {
    const error = new Error(`Order cannot be cancelled. Current status: ${order.status}`);
    error.statusCode = 400;
    throw error;
  }

  if (order.status !== ADMIN_CANCEL_STATUS) {
    const error = new Error(`Only food-on-the-way orders can be admin-cancelled. Current status: ${order.status}`);
    error.statusCode = 400;
    throw error;
  }

  if (!isPaymentEligibleForAdminCancel(order)) {
    const error = new Error('Order payment is not in a cancellable state. Cannot release settlement.');
    error.statusCode = 400;
    throw error;
  }

  const settlement = await OrderSettlement.findOne({ orderId: order._id });
  if (!settlement) {
    const error = new Error('Order settlement not found');
    error.statusCode = 400;
    throw error;
  }

  if (settlement.escrowStatus === 'released') {
    const error = new Error('Settlement already released. Cannot admin-cancel this order.');
    error.statusCode = 409;
    throw error;
  }

  if (settlement.escrowStatus === 'refunded') {
    const error = new Error('Settlement already refunded. Cannot admin-cancel this order.');
    error.statusCode = 409;
    throw error;
  }

  if (!isEscrowReadyForAdminCancel(settlement)) {
    const error = new Error(`Escrow is not held. Current status: ${settlement.escrowStatus || 'unknown'}`);
    error.statusCode = 400;
    throw error;
  }

  const trimmedReason = String(reason).trim();
  const cancelledAt = new Date();

  // Release partner settlements while order is still out_for_delivery.
  // If this fails, order status is unchanged (no cancelled-without-payout state).
  try {
    await calculateOrderSettlement(order._id);
    await ensureEscrowHeldForAdminCancel(order, await OrderSettlement.findOne({ orderId: order._id }));
    await releaseEscrow(order._id);
    // COD: payouts via releaseEscrow only — no cashInHand, no payment.completed.
  } catch (settlementError) {
    console.error('Admin cancel settlement failed:', settlementError.message);
    const error = new Error(`Failed to release settlement: ${settlementError.message}`);
    error.statusCode = 500;
    throw error;
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: ADMIN_CANCEL_STATUS,
    },
    {
      $set: {
        status: 'cancelled',
        cancelledBy: 'admin',
        cancellationReason: trimmedReason,
        cancelledAt,
      },
    },
    { new: true },
  );

  if (!updatedOrder) {
    const error = new Error(
      'Settlement was released but order status changed before cancellation could complete. Please contact support.',
    );
    error.statusCode = 409;
    throw error;
  }

  clearAssignmentTimer(updatedOrder._id.toString());
  await sendCancellationNotifications(updatedOrder);

  try {
    await AuditLog.createLog({
      entityType: 'order',
      entityId: updatedOrder._id,
      action: 'admin_order_cancel_with_settlement',
      actionType: 'update',
      performedBy: {
        type: 'admin',
        id: adminId,
        name: 'Admin',
      },
      transactionDetails: {
        orderId: updatedOrder.orderId,
        status: 'cancelled',
        cancelledBy: 'admin',
      },
      description: `Order ${updatedOrder.orderId} cancelled by admin with partner settlement`,
    });
  } catch (auditError) {
    console.warn('Admin cancel: audit log failed:', auditError.message);
  }

  return updatedOrder;
};
