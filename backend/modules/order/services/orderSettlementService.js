import Order from '../models/Order.js';
import OrderSettlement from '../models/OrderSettlement.js';
import DeliveryBoyCommission from '../../admin/models/DeliveryBoyCommission.js';
import FeeSettings from '../../admin/models/FeeSettings.js';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Offer from '../../restaurant/models/Offer.js';
import AdminCoupon from '../../admin/models/AdminCoupon.js';
import mongoose from 'mongoose';

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const ADMIN_DELIVERY_GST_RATE = 0.18;

const normalizeCouponSource = source => source === 'admin' ? 'admin' : source === 'restaurant' ? 'restaurant' : null;

const resolveCouponSourceForSettlement = async (order, restaurant) => {
  const explicitSource = normalizeCouponSource(order?.pricing?.couponSource || order?.pricing?.appliedCoupon?.source);
  if (explicitSource) return explicitSource;

  const couponCode = order?.pricing?.couponCode;
  if (!couponCode) return null;

  const now = new Date();
  if (restaurant?._id) {
    const restaurantOffer = await Offer.findOne({
      restaurant: restaurant._id,
      status: 'active',
      'items.couponCode': couponCode,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { endDate: null }
      ]
    }).select('_id').lean();
    if (restaurantOffer) return 'restaurant';
  }

  const adminCoupon = await AdminCoupon.findOne({
    code: couponCode,
    status: 'active',
    validFrom: { $lte: now },
    $or: [
      { validUntil: { $gte: now } },
      { validUntil: null }
    ]
  }).select('_id').lean();
  if (adminCoupon) return 'admin';

  return null;
};

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return numeric;
};

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

    let tierMeta = null;
    if (restaurant.zoneId) {
      const zone = await Zone.findById(restaurant.zoneId).select('tierId').lean();
      if (zone?.tierId) {
        const tier = await Tier.findById(zone.tierId).select('name deliveryPricing.distanceSlabs deliveryPricing.adminRetentionPercent').lean();
        if (tier) {
          // Needed for settlement snapshot/debug + tier-based delivery commission.
          tierMeta = {
            id: tier._id,
            name: tier.name,
            distanceSlabs: tier.deliveryPricing?.distanceSlabs || null,
            adminRetentionPercent: clampPercent(tier.deliveryPricing?.adminRetentionPercent ?? 0)
          };
        }
      }
    }

    const couponSource = await resolveCouponSourceForSettlement(order, restaurant);
    const couponDiscount = roundCurrency(order.pricing.discount || 0);
    const restaurantCouponDiscount = couponSource === 'restaurant' ? couponDiscount : 0;
    const adminCouponDiscount = couponSource === 'admin' ? couponDiscount : 0;

    const userPayment = {
      subtotal: roundCurrency(order.pricing.subtotal || 0),
      discount: couponDiscount,
      deliveryFee: roundCurrency(order.pricing.deliveryFee || 0),
      platformFee: roundCurrency(
        order.pricing.platformFee !== undefined && order.pricing.platformFee !== null
          ? order.pricing.platformFee
          : feeSettings?.platformFee || 0
      ),
      gst: roundCurrency(order.pricing.tax || 0),
      packagingFee: 0,
      total: roundCurrency(order.pricing.total || 0)
    };

    const foodPrice = roundCurrency(Math.max(0, userPayment.subtotal - restaurantCouponDiscount));
    const adminDeliveryCost = roundCurrency(order.pricing.adminDeliveryCost || order.pricing.deliveryFee || 0);
    const adminDeliveryGst = roundCurrency(adminDeliveryCost * ADMIN_DELIVERY_GST_RATE);
    const platformFee = roundCurrency(
      order.pricing.platformFee !== undefined
        ? order.pricing.platformFee
        : feeSettings?.platformFee || 0
    );
    const customerGst = roundCurrency(order.pricing.gstCollected ?? userPayment.gst);
    const gstCollected = roundCurrency(customerGst + adminDeliveryGst);
    // Recommended item fee remains a separate internal charge and is not part of payableToAdmin.
    const payableToAdmin = roundCurrency(adminDeliveryCost + adminDeliveryGst + platformFee + customerGst);
    const recommendedItemFee = roundCurrency(order.pricing.internalRecommendedFee || 0);

    const restaurantGrossCollection = roundCurrency(
      foodPrice + userPayment.deliveryFee + userPayment.platformFee + customerGst
    );
    const restaurantNetEarning = roundCurrency(restaurantGrossCollection - payableToAdmin - recommendedItemFee);
    const adminRecommendedFee = roundCurrency(recommendedItemFee);
    const adminCouponSubsidy = roundCurrency(adminCouponDiscount);

    const restaurantEarning = {
      foodPrice,
      commission: 0,
      adminDeliveryCost,
      adminDeliveryGst,
      platformFee,
      gstCollected,
      payableToAdmin,
      recommendedItemFee,
      couponDiscount: restaurantCouponDiscount,
      couponSource,
      commissionPercentage: 0,
      netEarning: restaurantNetEarning,
      status: 'pending'
    };

    let deliveryPartnerEarning = {
      basePayout: 0,
      distance: 0,
      commissionPerKm: 0,
      distanceCommission: 0,
      totalEarning: 0,
      status: 'pending'
    };

    /** Canonical trip distance (restaurant ↔ customer), same as pricing slabs */
    const settlementDeliveryKm = Math.max(0, Number(order.pricing?.distanceKm) || 0);
    const pickupLegKm =
      order.assignmentInfo?.distance !== undefined && order.assignmentInfo?.distance !== null
        ? Number(order.assignmentInfo.distance)
        : null;

    const adminRetentionPercent = clampPercent(tierMeta?.adminRetentionPercent ?? 0);
    let adminRetainedDelivery = roundCurrency(adminDeliveryCost * (adminRetentionPercent / 100));
    let deliveryPartnerShare = roundCurrency(adminDeliveryCost - adminRetainedDelivery);
    if (deliveryPartnerShare < 0) {
      deliveryPartnerShare = 0;
      adminRetainedDelivery = roundCurrency(adminDeliveryCost);
    }
    // Ensure exact paise-level reconciliation
    const splitDelta = roundCurrency(adminDeliveryCost - (adminRetainedDelivery + deliveryPartnerShare));
    if (splitDelta !== 0) {
      deliveryPartnerShare = roundCurrency(deliveryPartnerShare + splitDelta);
    }
    const adminBaseEarning = roundCurrency(platformFee + adminRetainedDelivery + gstCollected + adminRecommendedFee);
    const adminNetEarning = roundCurrency(Math.max(0, adminBaseEarning - adminCouponSubsidy));

    if (order.deliveryPartnerId && settlementDeliveryKm > 0 && deliveryPartnerShare > 0) {
      try {
        const deliveryCommission = await DeliveryBoyCommission.calculateCommission(
          settlementDeliveryKm,
          tierMeta?.name || null
        );

        deliveryPartnerEarning = {
          basePayout: deliveryCommission.breakdown.basePayout,
          distance: settlementDeliveryKm,
          commissionPerKm: deliveryCommission.breakdown.commissionPerKm,
          distanceCommission: deliveryCommission.breakdown.distanceCommission,
          totalEarning: roundCurrency(deliveryPartnerShare),
          status: 'pending'
        };
      } catch (commissionErr) {
        console.error('Delivery commission settlement error:', commissionErr.message);
        deliveryPartnerEarning = {
          basePayout: 0,
          distance: settlementDeliveryKm,
          commissionPerKm: 0,
          distanceCommission: roundCurrency(deliveryPartnerShare),
          totalEarning: roundCurrency(deliveryPartnerShare),
          status: 'pending'
        };
      }
    }

    const deliveryMargin = roundCurrency(adminDeliveryCost - deliveryPartnerEarning.totalEarning);

    const adminEarning = {
      commission: 0,
      platformFee,
      adminDeliveryCost,
      adminDeliveryGst,
      restaurantPayable: payableToAdmin,
      deliveryFee: adminDeliveryCost,
      gst: gstCollected,
      recommendedItemFee: adminRecommendedFee,
      couponDiscount: adminCouponDiscount,
      couponSource,
      deliveryMargin: deliveryMargin,
      totalEarning: adminNetEarning,
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
      couponCode: order.pricing.couponCode || null,
      couponSource,
      couponDiscount,
      restaurantCouponDiscount,
      adminCouponDiscount,
      settlementWindows: {
        restaurantEligibleAt,
        deliveryPartnerEligibleAt: deliveryEligibleAt
      },
      calculationSnapshot: {
        feeSettings: {
          platformFee: feeSettings?.platformFee,
          gstRate: feeSettings?.gstRate,
          distanceSlabs: tierMeta?.distanceSlabs,
          tier: tierMeta
        },
        pricingSnapshot: {
          distanceKm: order.pricing.distanceKm || 0,
          customerDeliveryFee: userPayment.deliveryFee,
          adminDeliveryCost,
          adminRetentionPercent,
          adminRetainedDelivery,
          deliveryPartnerShare,
          adminDeliveryGst,
          platformFee,
          gstCollected,
          payableToAdmin,
          couponCode: order.pricing.couponCode || null,
          couponSource,
          couponDiscount,
          restaurantCouponDiscount,
          adminCouponDiscount
        },
        deliveryCommission: deliveryPartnerEarning.distance > 0 ? {
          distance: deliveryPartnerEarning.distance,
          basePayout: deliveryPartnerEarning.basePayout,
          commissionPerKm: deliveryPartnerEarning.commissionPerKm,
          pickupLegKm
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
    if (newStatus === 'delivered') {
      try {
        await calculateOrderSettlement(orderId);
      } catch (recalcErr) {
        console.error('Settlement recalc on delivered failed:', recalcErr.message);
      }
    }

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
