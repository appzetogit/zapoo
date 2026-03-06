import Order from '../models/Order.js';
import OrderSettlement from '../models/OrderSettlement.js';
import DeliveryBoyCommission from '../../admin/models/DeliveryBoyCommission.js';
import FeeSettings from '../../admin/models/FeeSettings.js';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import mongoose from 'mongoose';

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

/**
 * Calculate comprehensive order settlement breakdown
 * This calculates earnings for User, Restaurant, Delivery Partner, and Admin
 */
export const calculateOrderSettlement = async (orderId) => {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new Error('Order not found');
    }

    const feeSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    let restaurant = null;
    if (mongoose.Types.ObjectId.isValid(order.restaurantId) && order.restaurantId.length === 24) {
      restaurant = await Restaurant.findById(order.restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { restaurantId: order.restaurantId },
          { slug: order.restaurantId }
        ]
      }).lean();
    }

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    let tierDistanceSlabs = [];
    let tierMeta = null;
    if (restaurant.zoneId) {
      const zone = await Zone.findById(restaurant.zoneId).select('tierId').lean();
      if (zone?.tierId) {
        const tier = await Tier.findById(zone.tierId).select('name deliveryPricing.distanceSlabs').lean();
        if (tier) {
          tierMeta = { id: tier._id, name: tier.name };
          tierDistanceSlabs = Array.isArray(tier?.deliveryPricing?.distanceSlabs)
            ? tier.deliveryPricing.distanceSlabs
            : [];
        }
      }
    }

    const userPayment = {
      subtotal: roundCurrency(order.pricing.subtotal || 0),
      discount: roundCurrency(order.pricing.discount || 0),
      deliveryFee: roundCurrency(order.pricing.deliveryFee || 0),
      platformFee: 0,
      gst: roundCurrency(order.pricing.tax || 0),
      packagingFee: 0,
      total: roundCurrency(order.pricing.total || 0)
    };

    const foodPrice = roundCurrency(userPayment.subtotal - userPayment.discount);
    const adminDeliveryCost = roundCurrency(order.pricing.adminDeliveryCost || order.pricing.deliveryFee || 0);
    const platformFee = roundCurrency(
      order.pricing.platformFee !== undefined
        ? order.pricing.platformFee
        : feeSettings?.platformFee || 0
    );
    const gstCollected = roundCurrency(order.pricing.gstCollected ?? userPayment.gst);
    const payableToAdmin = roundCurrency(adminDeliveryCost + platformFee + gstCollected);
    const recommendedItemFee = roundCurrency(order.pricing.internalRecommendedFee || 0);

    const restaurantGrossCollection = roundCurrency(foodPrice + userPayment.deliveryFee + userPayment.gst);
    const restaurantNetEarning = roundCurrency(restaurantGrossCollection - payableToAdmin - recommendedItemFee);

    const restaurantEarning = {
      foodPrice,
      commission: 0,
      adminDeliveryCost,
      platformFee,
      gstCollected,
      payableToAdmin,
      recommendedItemFee,
      commissionPercentage: 0,
      netEarning: restaurantNetEarning,
      status: 'pending'
    };

    let deliveryPartnerEarning = {
      basePayout: 0,
      distance: 0,
      commissionPerKm: 0,
      distanceCommission: 0,
      surgeMultiplier: 1,
      surgeAmount: 0,
      totalEarning: 0,
      status: 'pending'
    };

    if (order.deliveryPartnerId && order.assignmentInfo?.distance !== undefined && order.assignmentInfo?.distance !== null) {
      const distance = order.assignmentInfo.distance;
      const deliveryCommission = await DeliveryBoyCommission.calculateCommission(distance);
      const surgeMultiplier = order.assignmentInfo?.surgeMultiplier || 1;
      const baseEarning = deliveryCommission.commission;
      const surgeAmount = baseEarning * (surgeMultiplier - 1);

      deliveryPartnerEarning = {
        basePayout: deliveryCommission.breakdown.basePayout,
        distance: distance,
        commissionPerKm: deliveryCommission.breakdown.commissionPerKm,
        distanceCommission: deliveryCommission.breakdown.distanceCommission,
        surgeMultiplier: surgeMultiplier,
        surgeAmount: surgeAmount,
        totalEarning: roundCurrency(baseEarning + surgeAmount),
        status: 'pending'
      };
    }

    const deliveryMargin = roundCurrency(adminDeliveryCost - deliveryPartnerEarning.totalEarning);
    const adminRecommendedFee = roundCurrency(restaurantEarning.recommendedItemFee);
    const adminTotal = roundCurrency(platformFee + adminDeliveryCost + gstCollected + adminRecommendedFee);

    const adminEarning = {
      commission: 0,
      platformFee,
      adminDeliveryCost,
      restaurantPayable: payableToAdmin,
      deliveryFee: adminDeliveryCost,
      gst: gstCollected,
      recommendedItemFee: adminRecommendedFee,
      deliveryMargin: deliveryMargin,
      totalEarning: adminTotal,
      status: 'pending'
    };

    const now = new Date();
    const restaurantEligibleAt = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const deliveryEligibleAt = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    let settlement = await OrderSettlement.findOne({ orderId });

    const settlementData = {
      orderNumber: order.orderId,
      userId: order.userId,
      restaurantId: restaurant._id,
      restaurantName: restaurant.name || order.restaurantName,
      deliveryPartnerId: order.deliveryPartnerId || null,
      userPayment,
      restaurantEarning,
      deliveryPartnerEarning,
      adminEarning,
      escrowStatus: 'pending',
      escrowAmount: userPayment.total,
      settlementStatus: 'pending',
      settlementWindows: {
        restaurantEligibleAt,
        deliveryPartnerEligibleAt: deliveryEligibleAt
      },
      calculationSnapshot: {
        feeSettings: {
          platformFee: feeSettings?.platformFee,
          gstRate: feeSettings?.gstRate,
          distanceSlabs: tierDistanceSlabs,
          tier: tierMeta
        },
        pricingSnapshot: {
          distanceKm: order.pricing.distanceKm || 0,
          customerDeliveryFee: userPayment.deliveryFee,
          adminDeliveryCost,
          platformFee,
          gstCollected,
          payableToAdmin
        },
        deliveryCommission: deliveryPartnerEarning.distance > 0 ? {
          distance: deliveryPartnerEarning.distance,
          basePayout: deliveryPartnerEarning.basePayout,
          commissionPerKm: deliveryPartnerEarning.commissionPerKm
        } : null,
        calculatedAt: now
      }
    };

    if (settlement) {
      Object.assign(settlement, settlementData);
      await settlement.save();
    } else {
      settlement = await OrderSettlement.create({
        orderId,
        ...settlementData
      });
    }

    return settlement;
  } catch (error) {
    console.error('Error calculating order settlement:', error);
    throw new Error(`Failed to calculate order settlement: ${error.message}`);
  }
};

/**
 * Get settlement details for an order
 */
export const getOrderSettlement = async (orderId) => {
  try {
    let settlement = await OrderSettlement.findOne({ orderId })
      .populate('orderId', 'orderId status')
      .populate('restaurantId', 'name restaurantId')
      .populate('deliveryPartnerId', 'name phone')
      .lean();

    if (!settlement) {
      settlement = await calculateOrderSettlement(orderId);
    }

    return settlement;
  } catch (error) {
    console.error('Error getting order settlement:', error);
    throw error;
  }
};

/**
 * Update settlement when order status changes
 */
export const updateSettlementOnStatusChange = async (orderId, newStatus) => {
  try {
    const settlement = await OrderSettlement.findOne({ orderId });
    if (!settlement) {
      return;
    }

    if (newStatus === 'delivered') {
      settlement.escrowStatus = 'released';
      settlement.escrowReleasedAt = new Date();
      settlement.settlementStatus = 'completed';
    } else if (newStatus === 'cancelled') {
      settlement.escrowStatus = 'refunded';
      settlement.settlementStatus = 'cancelled';
    }

    await settlement.save();
  } catch (error) {
    console.error('Error updating settlement on status change:', error);
    throw error;
  }
};
