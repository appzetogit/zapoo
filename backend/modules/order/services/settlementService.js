import OrderSettlement from '../models/OrderSettlement.js';
import RestaurantWallet from '../../restaurant/models/RestaurantWallet.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const creditRestaurantWallet = async (settlement) => {
  if (!settlement.restaurantId || settlement.restaurantEarning?.netEarning <= 0) return;

  const wallet = await RestaurantWallet.findOrCreateByRestaurantId(settlement.restaurantId);
  const alreadyCredited = wallet.transactions?.some(
    (t) => t.orderId && String(t.orderId) === String(settlement.orderId) && t.type === 'payment'
  );

  if (alreadyCredited) {
    return;
  }

  wallet.addTransaction({
    amount: settlement.restaurantEarning.netEarning,
    type: 'payment',
    status: 'Completed',
    description: `Settlement credit for order ${settlement.orderNumber}`,
    orderId: settlement.orderId
  });

  await wallet.save();
};

const creditDeliveryWallet = async (settlement) => {
  if (!settlement.deliveryPartnerId || settlement.deliveryPartnerEarning?.totalEarning <= 0) return;

  const wallet = await DeliveryWallet.findOrCreateByDeliveryId(settlement.deliveryPartnerId);
  const alreadyCredited = wallet.transactions?.some(
    (t) => t.orderId && String(t.orderId) === String(settlement.orderId) && t.type === 'payment'
  );

  if (alreadyCredited) {
    return;
  }

  wallet.addTransaction({
    amount: settlement.deliveryPartnerEarning.totalEarning,
    type: 'payment',
    status: 'Completed',
    description: `Weekly settlement for order ${settlement.orderNumber}`,
    orderId: settlement.orderId,
    paymentCollected: false
  });

  await wallet.save();
};

/**
 * Get pending settlements for restaurants
 */
export const getPendingRestaurantSettlements = async (restaurantId = null, startDate = null, endDate = null) => {
  try {
    const now = new Date();
    const query = {
      'restaurantEarning.status': 'pending',
      restaurantSettled: false,
      settlementStatus: 'completed',
      'settlementWindows.restaurantEligibleAt': { $lte: now }
    };

    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const settlements = await OrderSettlement.find(query)
      .populate('orderId', 'orderId status deliveredAt')
      .populate('restaurantId', 'name restaurantId')
      .sort({ createdAt: -1 })
      .lean();

    return settlements;
  } catch (error) {
    console.error('Error getting pending restaurant settlements:', error);
    throw error;
  }
};

/**
 * Get pending settlements for delivery partners
 */
export const getPendingDeliverySettlements = async (deliveryId = null, startDate = null, endDate = null) => {
  try {
    const now = new Date();
    const query = {
      'deliveryPartnerEarning.status': 'pending',
      deliveryPartnerSettled: false,
      settlementStatus: 'completed',
      deliveryPartnerId: { $ne: null },
      'settlementWindows.deliveryPartnerEligibleAt': { $lte: now }
    };

    if (deliveryId) {
      query.deliveryPartnerId = deliveryId;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const settlements = await OrderSettlement.find(query)
      .populate('orderId', 'orderId status deliveredAt')
      .populate('deliveryPartnerId', 'name phone')
      .sort({ createdAt: -1 })
      .lean();

    return settlements;
  } catch (error) {
    console.error('Error getting pending delivery settlements:', error);
    throw error;
  }
};

/**
 * Generate settlement report for restaurants
 */
export const generateRestaurantSettlementReport = async (restaurantId, startDate, endDate) => {
  try {
    const settlements = await OrderSettlement.find({
      restaurantId: restaurantId,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('orderId', 'orderId status deliveredAt')
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = settlements.reduce((sum, s) => sum + (s.restaurantEarning.netEarning || 0), 0);
    const totalOrders = settlements.length;

    return {
      restaurantId,
      period: {
        startDate,
        endDate
      },
      summary: {
        totalOrders,
        totalEarnings,
        averageOrderValue: totalOrders > 0 ? totalEarnings / totalOrders : 0
      },
      settlements: settlements.map(s => ({
        orderNumber: s.orderNumber,
        orderDate: s.createdAt,
        foodPrice: s.restaurantEarning.foodPrice,
        adminDeliveryCost: s.restaurantEarning.adminDeliveryCost || 0,
        platformFee: s.restaurantEarning.platformFee || 0,
        gstCollected: s.restaurantEarning.gstCollected || 0,
        payableToAdmin: s.restaurantEarning.payableToAdmin || 0,
        netEarning: s.restaurantEarning.netEarning,
        status: s.restaurantEarning.status
      }))
    };
  } catch (error) {
    console.error('Error generating restaurant settlement report:', error);
    throw error;
  }
};

/**
 * Generate settlement report for delivery partners
 */
export const generateDeliverySettlementReport = async (deliveryId, startDate, endDate) => {
  try {
    const settlements = await OrderSettlement.find({
      deliveryPartnerId: deliveryId,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('orderId', 'orderId status deliveredAt')
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = settlements.reduce((sum, s) => sum + (s.deliveryPartnerEarning.totalEarning || 0), 0);
    const totalOrders = settlements.length;
    const totalDistance = settlements.reduce((sum, s) => sum + (s.deliveryPartnerEarning.distance || 0), 0);

    return {
      deliveryId,
      period: {
        startDate,
        endDate
      },
      summary: {
        totalOrders,
        totalEarnings,
        totalDistance: totalDistance.toFixed(2),
        averageEarningPerOrder: totalOrders > 0 ? totalEarnings / totalOrders : 0
      },
      settlements: settlements.map(s => ({
        orderNumber: s.orderNumber,
        orderDate: s.createdAt,
        distance: s.deliveryPartnerEarning.distance,
        basePayout: s.deliveryPartnerEarning.basePayout,
        distanceCommission: s.deliveryPartnerEarning.distanceCommission,
        totalEarning: s.deliveryPartnerEarning.totalEarning,
        status: s.deliveryPartnerEarning.status
      }))
    };
  } catch (error) {
    console.error('Error generating delivery settlement report:', error);
    throw error;
  }
};

/**
 * Mark settlements as processed
 */
export const markSettlementsAsProcessed = async (settlementIds, actorType) => {
  try {
    const settlements = await OrderSettlement.find({
      _id: { $in: settlementIds }
    });

    const now = new Date();
    for (const settlement of settlements) {
      if (
        (actorType === 'admin' || actorType === 'restaurant') &&
        !settlement.restaurantSettled &&
        settlement.restaurantEarning?.status === 'pending' &&
        settlement.settlementWindows?.restaurantEligibleAt &&
        settlement.settlementWindows.restaurantEligibleAt <= now
      ) {
        await creditRestaurantWallet(settlement);
        settlement.restaurantEarning.status = 'credited';
        settlement.restaurantEarning.creditedAt = now;
        settlement.restaurantSettled = true;
      }

      if (
        (actorType === 'admin' || actorType === 'delivery') &&
        !settlement.deliveryPartnerSettled &&
        settlement.deliveryPartnerEarning?.status === 'pending' &&
        settlement.settlementWindows?.deliveryPartnerEligibleAt &&
        settlement.settlementWindows.deliveryPartnerEligibleAt <= now
      ) {
        await creditDeliveryWallet(settlement);
        settlement.deliveryPartnerEarning.status = 'credited';
        settlement.deliveryPartnerEarning.creditedAt = now;
        settlement.deliveryPartnerSettled = true;
      }

      await settlement.save();
    }

    return settlements;
  } catch (error) {
    console.error('Error marking settlements as processed:', error);
    throw error;
  }
};

export const initializeSettlementWindows = async () => {
  const now = new Date();
  const restaurantEligibleAt = new Date(now.getTime() + (3 * DAY_MS));
  const deliveryEligibleAt = new Date(now.getTime() + (7 * DAY_MS));

  await OrderSettlement.updateMany(
    {
      settlementStatus: 'completed',
      $or: [
        { 'settlementWindows.restaurantEligibleAt': { $exists: false } },
        { 'settlementWindows.deliveryPartnerEligibleAt': { $exists: false } }
      ]
    },
    {
      $set: {
        'settlementWindows.restaurantEligibleAt': restaurantEligibleAt,
        'settlementWindows.deliveryPartnerEligibleAt': deliveryEligibleAt
      }
    }
  );
};
