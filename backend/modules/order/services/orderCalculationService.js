import Restaurant from '../../restaurant/models/Restaurant.js';
import Offer from '../../restaurant/models/Offer.js';
import FeeSettings from '../../admin/models/FeeSettings.js';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import mongoose from 'mongoose';

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

/** Treat common truthy shapes from JSON / older clients */
const isRestaurantCustomDeliveryEnabled = (restaurant) => {
  const v = restaurant?.deliveryPricingConfig?.isEnabled;
  return v === true || v === 'true' || v === 1 || v === '1';
};

const isInRange = (value, min, max) => {
  if (value < min) return false;
  if (max === null || max === undefined) return true;
  return value <= max;
};

const getDefaultDistanceSlabs = () => ([
  {
    _id: 'default-base-slab',
    name: 'Base',
    minKm: 0,
    maxKm: 3,
    isBaseSlab: true,
    adminPerKmRate: 0,
    isActive: true
  }
]);

const getFallbackFeeSettings = () => ({
  deliveryFee: 25,
  freeDeliveryThreshold: 149,
  platformFee: 5,
  gstRate: 5,
  recommendedItemFee: 0,
  distanceSlabs: getDefaultDistanceSlabs(),
});

const getTierDistanceSlabs = (tier) => {
  const slabs = tier?.deliveryPricing?.distanceSlabs;
  if (!Array.isArray(slabs) || slabs.length === 0) return [];
  return slabs;
};

const getFeeSettings = async () => {
  try {
    const feeSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    if (!feeSettings) {
      return getFallbackFeeSettings();
    }

    return {
      ...getFallbackFeeSettings(),
      ...feeSettings,
      distanceSlabs: (feeSettings.distanceSlabs && feeSettings.distanceSlabs.length > 0)
        ? feeSettings.distanceSlabs
        : getDefaultDistanceSlabs()
    };
  } catch (error) {
    console.error('Error fetching fee settings:', error);
    return getFallbackFeeSettings();
  }
};

const findOrderValueSlab = (orderValueSlabs, subtotal) => {
  if (!Array.isArray(orderValueSlabs) || orderValueSlabs.length === 0) return null;

  const sortedSlabs = [...orderValueSlabs].sort((a, b) => Number(a.minOrderValue || 0) - Number(b.minOrderValue || 0));
  return sortedSlabs.find((slab) =>
    isInRange(
      subtotal,
      Number(slab.minOrderValue || 0),
      slab.maxOrderValue === null || slab.maxOrderValue === undefined ? null : Number(slab.maxOrderValue)
    )
  ) || null;
};

const findDistanceSlab = (distanceSlabs, distanceKm) => {
  const activeSlabs = (distanceSlabs || []).filter((slab) => slab.isActive !== false);
  if (activeSlabs.length === 0) return null;

  const sortedSlabs = [...activeSlabs].sort((a, b) => Number(a.minKm || 0) - Number(b.minKm || 0));
  return sortedSlabs.find((slab) =>
    isInRange(
      distanceKm,
      Number(slab.minKm || 0),
      slab.maxKm === null || slab.maxKm === undefined ? null : Number(slab.maxKm)
    )
  ) || sortedSlabs[sortedSlabs.length - 1] || null;
};

const findBaseDistanceSlab = (distanceSlabs) => {
  const activeSlabs = (distanceSlabs || []).filter((slab) => slab.isActive !== false);
  return activeSlabs.find((slab) => slab.isBaseSlab === true) || activeSlabs[0] || null;
};

const calculateDistanceFromAddresses = (restaurant, deliveryAddress) => {
  const resCoords = restaurant?.location?.coordinates;
  const resLat = restaurant?.location?.latitude ?? resCoords?.[1];
  const resLng = restaurant?.location?.longitude ?? resCoords?.[0];

  let delLng;
  let delLat;
  const delLoc = deliveryAddress?.location;
  if (delLoc?.coordinates?.length >= 2) {
    delLng = Number(delLoc.coordinates[0]);
    delLat = Number(delLoc.coordinates[1]);
  } else if (delLoc?.latitude != null && delLoc?.longitude != null) {
    delLng = Number(delLoc.longitude);
    delLat = Number(delLoc.latitude);
  } else if (deliveryAddress?.longitude != null && deliveryAddress?.latitude != null) {
    delLng = Number(deliveryAddress.longitude);
    delLat = Number(deliveryAddress.latitude);
  }

  if (
    resLat != null &&
    resLng != null &&
    delLat != null &&
    delLng != null &&
    Number.isFinite(resLat) &&
    Number.isFinite(resLng) &&
    Number.isFinite(delLat) &&
    Number.isFinite(delLng)
  ) {
    return calculateDistance([resLng, resLat], [delLng, delLat]);
  }

  return 0;
};

const resolveTierAndZone = async (restaurant) => {
  if (!restaurant?.zoneId) {
    return { zone: null, tier: null };
  }

  const zone = await Zone.findById(restaurant.zoneId).lean();
  if (!zone?.tierId) {
    return { zone, tier: null };
  }

  const tier = await Tier.findById(zone.tierId).lean();
  return { zone, tier };
};

const calculateRestaurantCustomerDeliveryFee = ({
  subtotal,
  distanceKm,
  restaurant,
  matchedDistanceSlab,
  distanceSlabs = [],
}) => {
  const config = restaurant?.deliveryPricingConfig;

  if (!isRestaurantCustomDeliveryEnabled(restaurant)) {
    return {
      customerDeliveryFee: 0,
      customerPerKmRate: 0,
      matchedOrderValueSlab: null,
    };
  }

  const matchedOrderValueSlab = findOrderValueSlab(config.orderValueSlabs, subtotal);
  if (!matchedOrderValueSlab || !matchedDistanceSlab) {
    return {
      customerDeliveryFee: 0,
      customerPerKmRate: 0,
      matchedOrderValueSlab,
    };
  }

  let matchedRateRule = (config.customerDeliveryRates || []).find((rate) =>
    String(rate.distanceSlabId) === String(matchedDistanceSlab._id) &&
    String(rate.orderValueSlabId) === String(matchedOrderValueSlab._id)
  );

  // If tier distance slabs were recreated, rate rows may still reference old distanceSlabIds.
  // When there is exactly one rate row for this order-value slab, use it if either:
  // - that row's distanceSlabId is not in the current tier (stale refs), or
  // - the tier has only one active distance slab (unambiguous).
  if (!matchedRateRule && matchedDistanceSlab && matchedOrderValueSlab) {
    const ratesForOrderSlab = (config.customerDeliveryRates || []).filter(
      (rate) => String(rate.orderValueSlabId) === String(matchedOrderValueSlab._id)
    );
    if (ratesForOrderSlab.length === 1) {
      const only = ratesForOrderSlab[0];
      const activeTierSlabIds = new Set(
        (distanceSlabs || []).filter((s) => s.isActive !== false).map((s) => String(s._id))
      );
      const onlyDistId = String(only.distanceSlabId || '');
      const staleDistanceSlabRef = Boolean(onlyDistId && !activeTierSlabIds.has(onlyDistId));
      const singleActiveTierSlab = activeTierSlabIds.size === 1;
      if (staleDistanceSlabRef || singleActiveTierSlab) {
        matchedRateRule = only;
      }
    }
  }

  const customerPerKmRate = Number(matchedRateRule?.perKmRate || 0);
  const customerDeliveryFee = roundCurrency(distanceKm * customerPerKmRate);

  return {
    customerDeliveryFee,
    customerPerKmRate,
    matchedOrderValueSlab,
  };
};

const calculateAdminDeliveryCost = ({
  distanceKm,
  tier,
  matchedDistanceSlab,
  baseDistanceSlab,
}) => {
  const tierBasePay = Number(tier?.deliveryPricing?.basePay || tier?.deliveryPricing?.baseFee || 0);

  if (!matchedDistanceSlab) {
    return {
      adminDeliveryCost: 0,
      usedTierBasePay: false,
      tierBasePay,
    };
  }

  if (!baseDistanceSlab) {
    return {
      adminDeliveryCost: roundCurrency(distanceKm * Number(matchedDistanceSlab.adminPerKmRate || 0)),
      usedTierBasePay: false,
      tierBasePay,
    };
  }

  const minBaseKm = Number(baseDistanceSlab.minKm || 0);
  const maxBaseKm = baseDistanceSlab.maxKm === null || baseDistanceSlab.maxKm === undefined
    ? null
    : Number(baseDistanceSlab.maxKm);

  if (isInRange(distanceKm, minBaseKm, maxBaseKm)) {
    return {
      adminDeliveryCost: roundCurrency(tierBasePay),
      usedTierBasePay: true,
      tierBasePay,
    };
  }

  const adminPerKmRate = Number(matchedDistanceSlab?.adminPerKmRate || 0);
  return {
    adminDeliveryCost: roundCurrency(distanceKm * adminPerKmRate),
    usedTierBasePay: false,
    tierBasePay,
  };
};

const calculateTierPlatformFee = (tier, defaultPlatformFee) => {
  if (tier?.platformFee !== undefined && tier?.platformFee !== null) {
    return Number(tier.platformFee);
  }
  return Number(defaultPlatformFee || 0);
};

/**
 * Calculate GST (Goods and Services Tax)
 * GST is calculated on subtotal after discounts
 */
export const calculateGST = async (subtotal, discount = 0, restaurant = null, passedFeeSettings = null) => {
  const taxableAmount = Math.max(subtotal - discount, 0);
  const feeSettings = passedFeeSettings || await getFeeSettings();
  const gstRate = (feeSettings.gstRate || 5) / 100;

  const isRegistered = restaurant?.onboarding?.step3?.gst?.isRegistered || false;
  if (isRegistered) {
    return 0;
  }

  return Math.round(taxableAmount * gstRate);
};

/**
 * Calculate discount based on coupon code
 */
export const calculateDiscount = (coupon, subtotal) => {
  if (!coupon) return 0;

  if (coupon.minOrder && subtotal < coupon.minOrder) {
    return 0;
  }

  if (coupon.type === 'percentage') {
    const maxDiscount = coupon.maxDiscount || Infinity;
    const discount = Math.min(
      Math.round(subtotal * (coupon.discount / 100)),
      maxDiscount
    );
    return discount;
  } else if (coupon.type === 'flat') {
    return Math.min(coupon.discount, subtotal);
  }

  return Math.min(coupon.discount || 0, subtotal);
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export const calculateDistance = (coord1, coord2) => {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Main function to calculate order pricing
 */
export const calculateOrderPricing = async ({
  items,
  restaurantId,
  passedRestaurant = null,
  deliveryAddress = null,
  couponCode = null,
}) => {
  try {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.price || 0) * (item.quantity || 1);
    }, 0);

    if (subtotal <= 0) {
      throw new Error('Order subtotal must be greater than 0');
    }

    let restaurant = passedRestaurant;
    if (!restaurant && restaurantId) {
      if (mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
        restaurant = await Restaurant.findById(restaurantId).lean();
      }
      if (!restaurant) {
        restaurant = await Restaurant.findOne({
          $or: [
            { restaurantId: restaurantId },
            { slug: restaurantId }
          ]
        }).lean();
      }
    }

    let discount = 0;
    let appliedCoupon = null;
    /** Full offer doc when a coupon applies (for waivesDeliveryFee, etc.) */
    let offerForCoupon = null;

    if (couponCode && restaurant) {
      try {
        let restaurantObjectId = restaurant._id;
        if (!restaurantObjectId && mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
          restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
        }

        if (restaurantObjectId) {
          const now = new Date();

          const offer = await Offer.findOne({
            restaurant: restaurantObjectId,
            status: 'active',
            'items.couponCode': couponCode,
            startDate: { $lte: now },
            $or: [
              { endDate: { $gte: now } },
              { endDate: null }
            ]
          }).lean();

          if (offer) {
            const couponItem = offer.items.find(item => item.couponCode === couponCode);
            if (couponItem) {
              const cartItemIds = items.map(item => item.itemId);
              const isValidForCart = couponItem.itemId && cartItemIds.includes(couponItem.itemId);
              const minOrderMet = !offer.minOrderValue || subtotal >= offer.minOrderValue;

              if (isValidForCart && minOrderMet) {
                const itemInCart = items.find(item => item.itemId === couponItem.itemId);
                if (itemInCart) {
                  const itemQuantity = itemInCart.quantity || 1;
                  const discountPerItem = couponItem.originalPrice - couponItem.discountedPrice;
                  discount = Math.round(discountPerItem * itemQuantity);
                  const itemSubtotal = (itemInCart.price || 0) * itemQuantity;
                  discount = Math.min(discount, itemSubtotal);
                }

                appliedCoupon = {
                  code: couponCode,
                  discount: discount,
                  discountPercentage: couponItem.discountPercentage,
                  minOrder: offer.minOrderValue || 0,
                  type: offer.discountType === 'percentage' ? 'percentage' : 'flat',
                  itemId: couponItem.itemId,
                  itemName: couponItem.itemName,
                  originalPrice: couponItem.originalPrice,
                  discountedPrice: couponItem.discountedPrice,
                };
                offerForCoupon = offer;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching coupon from database: ${error.message}`);
      }
    }

    const feeSettings = await getFeeSettings();
    const { tier } = await resolveTierAndZone(restaurant);
    const distanceKmRaw = calculateDistanceFromAddresses(restaurant, deliveryAddress);
    const distanceKm = roundCurrency(distanceKmRaw);

    const tierDistanceSlabs = getTierDistanceSlabs(tier);
    const distanceSlabs = tierDistanceSlabs;
    const matchedDistanceSlab = findDistanceSlab(distanceSlabs, distanceKm) || findBaseDistanceSlab(distanceSlabs);
    const baseDistanceSlab = findBaseDistanceSlab(distanceSlabs);

    const {
      customerDeliveryFee: customerDeliveryFeeBeforeWaivers,
      customerPerKmRate,
      matchedOrderValueSlab,
    } = calculateRestaurantCustomerDeliveryFee({
      subtotal,
      distanceKm,
      restaurant,
      matchedDistanceSlab,
      distanceSlabs,
    });

    const {
      adminDeliveryCost,
      usedTierBasePay,
      tierBasePay,
    } = calculateAdminDeliveryCost({
      distanceKm,
      tier,
      matchedDistanceSlab,
      baseDistanceSlab,
    });

    const platformFee = roundCurrency(calculateTierPlatformFee(tier, feeSettings.platformFee));
    const gst = await calculateGST(subtotal, discount, restaurant, feeSettings);

    /** After distance/order-value rules; may be zeroed by coupon or global threshold (threshold skipped when custom restaurant pricing is enabled) */
    let finalCustomerDeliveryFee = roundCurrency(customerDeliveryFeeBeforeWaivers);
    let freeDeliveryReason = null;
    const netAfterDiscount = Math.max(subtotal - discount, 0);

    if (appliedCoupon && offerForCoupon?.waivesDeliveryFee === true) {
      finalCustomerDeliveryFee = 0;
      freeDeliveryReason = 'coupon';
    } else if (!isRestaurantCustomDeliveryEnabled(restaurant)) {
      // Global free-delivery threshold applies only when restaurant is NOT using
      // custom per-km / slab matrix (matrix is source of truth when enabled).
      const threshold = Number(feeSettings.freeDeliveryThreshold || 0);
      if (threshold > 0 && netAfterDiscount >= threshold) {
        finalCustomerDeliveryFee = 0;
        freeDeliveryReason = 'threshold';
      }
    }

    let internalRecommendedFee = 0;
    let recommendedFeePerItem = Number(feeSettings.recommendedItemFee || 0);

    if (tier?.recommendedItemFee !== undefined && tier?.recommendedItemFee !== null) {
      recommendedFeePerItem = Number(tier.recommendedItemFee);
    }

    if (recommendedFeePerItem > 0) {
      items.forEach(item => {
        if (item.isRecommended) {
          internalRecommendedFee += recommendedFeePerItem * (item.quantity || 1);
        }
      });
    }

    const total = roundCurrency(subtotal - discount + finalCustomerDeliveryFee + platformFee + gst);
    const restaurantPayableToAdmin = roundCurrency(adminDeliveryCost + platformFee + gst);
    const savings = roundCurrency(discount);

    const pricingDiagnostics = [];
    if (isRestaurantCustomDeliveryEnabled(restaurant)) {
      if (!restaurant.zoneId) {
        pricingDiagnostics.push({ code: 'NO_ZONE', message: 'Restaurant has no zone — tier slabs unavailable.' });
      }
      if (!tier) {
        pricingDiagnostics.push({ code: 'NO_TIER', message: 'Could not resolve tier from zone — check zone.tierId.' });
      }
      if (distanceSlabs.length === 0) {
        pricingDiagnostics.push({ code: 'NO_TIER_SLABS', message: 'Tier has no distance slabs — configure tier delivery pricing.' });
      }
      if (!matchedDistanceSlab) {
        pricingDiagnostics.push({ code: 'NO_DISTANCE_SLAB', message: 'No distance slab matched for this trip.' });
      }
      if (!matchedOrderValueSlab) {
        pricingDiagnostics.push({ code: 'NO_ORDER_VALUE_SLAB', message: 'Cart subtotal does not match any order-value slab.' });
      }
      if (
        finalCustomerDeliveryFee === 0 &&
        freeDeliveryReason === null &&
        customerDeliveryFeeBeforeWaivers === 0
      ) {
        pricingDiagnostics.push({
          code: 'ZERO_DELIVERY_BEFORE_WAIVERS',
          message: 'Customer delivery is ₹0 before waivers — enable pricing, fill rate grid, or check slabs.',
        });
      }
    }

    return {
      subtotal: roundCurrency(subtotal),
      discount: roundCurrency(discount),
      deliveryFee: finalCustomerDeliveryFee,
      platformFee,
      tax: gst,
      total,
      customerPayableTotal: total,
      savings,
      internalRecommendedFee: roundCurrency(internalRecommendedFee),
      internalAdminDeliveryCost: adminDeliveryCost,
      restaurantPayableToAdmin,
      gstCollected: gst,
      distanceKm,
      appliedCoupon: appliedCoupon ? {
        code: appliedCoupon.code,
        discount: discount,
        freeDelivery: freeDeliveryReason === 'coupon' || freeDeliveryReason === 'threshold',
      } : null,
      pricingMeta: {
        tierId: tier?._id || null,
        tierName: tier?.name || null,
        tierDistanceSlabCount: distanceSlabs.length,
        tierBasePay: roundCurrency(tierBasePay),
        usedTierBasePay,
        distanceSlabId: matchedDistanceSlab?._id || null,
        distanceSlabName: matchedDistanceSlab?.name || null,
        baseDistanceSlabId: baseDistanceSlab?._id || null,
        baseDistanceSlabRange: baseDistanceSlab
          ? {
            minKm: Number(baseDistanceSlab.minKm || 0),
            maxKm: baseDistanceSlab.maxKm === null || baseDistanceSlab.maxKm === undefined ? null : Number(baseDistanceSlab.maxKm),
          }
          : null,
        orderValueSlabId: matchedOrderValueSlab?._id || null,
        orderValueSlab: matchedOrderValueSlab
          ? {
            minOrderValue: Number(matchedOrderValueSlab.minOrderValue || 0),
            maxOrderValue: matchedOrderValueSlab.maxOrderValue === null || matchedOrderValueSlab.maxOrderValue === undefined
              ? null
              : Number(matchedOrderValueSlab.maxOrderValue),
            label: matchedOrderValueSlab.label || null,
          }
          : null,
        customerPerKmRate: roundCurrency(customerPerKmRate),
        adminPerKmRate: roundCurrency(Number(matchedDistanceSlab?.adminPerKmRate || 0)),
        freeDeliveryReason,
        customerDeliveryFeeBeforeWaivers: roundCurrency(customerDeliveryFeeBeforeWaivers),
        pricingDiagnostics,
      },
      breakdown: {
        itemTotal: roundCurrency(subtotal),
        discountAmount: roundCurrency(discount),
        customerDeliveryFee: finalCustomerDeliveryFee,
        gstCollected: gst,
        customerTotal: total,
        adminDeliveryCost,
        platformFee,
        restaurantPayableToAdmin,
      }
    };
  } catch (error) {
    throw new Error(`Failed to calculate order pricing: ${error.message}`);
  }
};
