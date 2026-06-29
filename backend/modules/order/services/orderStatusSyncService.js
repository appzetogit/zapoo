import Order from '../models/Order.js';

const TERMINAL_STATUSES = new Set(['delivered', 'cancelled', 'refunded', 'failed']);

const OUT_FOR_DELIVERY_PHASES = new Set([
  'en_route_to_delivery',
  'at_delivery',
  'picked_up',
]);

/**
 * True when delivery flow has moved past restaurant pickup even if order.status lagged.
 */
export const isEffectivelyOutForDelivery = (order = {}) => {
  if (!order || TERMINAL_STATUSES.has(order.status)) {
    return false;
  }
  if (order.status === 'out_for_delivery') {
    return true;
  }
  if (order.tracking?.outForDelivery?.status) {
    return true;
  }
  if (order.deliveryState?.orderIdConfirmedAt) {
    return true;
  }
  if (order.deliveryState?.status === 'order_confirmed') {
    return true;
  }
  const phase = order.deliveryState?.currentPhase;
  return OUT_FOR_DELIVERY_PHASES.has(phase);
};

/**
 * Persist out_for_delivery when delivery state already indicates rider is en route.
 * @returns {Promise<object|null>} Updated order document (lean) or null if no sync needed
 */
export const syncOutForDeliveryStatusIfNeeded = async (orderOrId) => {
  const orderId = orderOrId?._id || orderOrId;
  if (!orderId) {
    return null;
  }

  const order = typeof orderOrId === 'object' && orderOrId?.status
    ? orderOrId
    : await Order.findById(orderId).lean();

  if (!order || order.status === 'out_for_delivery' || !isEffectivelyOutForDelivery(order)) {
    return null;
  }

  const timestamp = order.tracking?.outForDelivery?.timestamp || new Date();
  return Order.findByIdAndUpdate(
    order._id,
    {
      $set: {
        status: 'out_for_delivery',
        'tracking.outForDelivery': {
          status: true,
          timestamp,
        },
      },
    },
    { new: true },
  ).lean();
};

/**
 * Mongo filter for admin "food-on-the-way" including legacy mismatched rows.
 */
export const buildFoodOnTheWayQuery = () => {
  const activeStatuses = {
    $nin: ['delivered', 'cancelled', 'refunded', 'failed', 'out_for_delivery'],
  };

  return {
    $or: [
      { status: 'out_for_delivery' },
      {
        status: activeStatuses,
        'tracking.outForDelivery.status': true,
      },
      {
        status: activeStatuses,
        'deliveryState.orderIdConfirmedAt': { $exists: true, $ne: null },
      },
      {
        status: activeStatuses,
        'deliveryState.currentPhase': { $in: [...OUT_FOR_DELIVERY_PHASES] },
      },
      {
        status: activeStatuses,
        'deliveryState.status': 'order_confirmed',
      },
    ],
  };
};
