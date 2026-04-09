import Restaurant from '../../restaurant/models/Restaurant.js';
import Offer from '../../restaurant/models/Offer.js';
import AdminCoupon from '../../admin/models/AdminCoupon.js';
import FeeSettings from '../../admin/models/FeeSettings.js';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import Order from '../models/Order.js';
import { resolveZoneAndTierForLocation } from '../../admin/services/restaurantZoneAssignmentService.js';
import mongoose from 'mongoose';
import { resolveLocalizedText } from '../../../shared/i18n/localizedText.js';
import { DEFAULT_LOCALE, normalizeLocale } from '../../../shared/i18n/localeConstants.js';

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const normalizeCouponCode = (code = '') => String(code || '').trim().toUpperCase();

/** Treat common truthy shapes from JSON / older clients */
const isRestaurantCustomDeliveryEnabled = (restaurant) => {
  const v = restaurant?.deliveryPricingConfig?.isEnabled;
  if (v === true || v === 'true' || v === 1 || v === '1') return true;

  // Safety fallback: if pricing grid data exists, treat custom pricing as enabled
  // even if legacy/stale isEnabled flag is false.
  const orderSlabs = restaurant?.deliveryPricingConfig?.orderValueSlabs;
  const rates = restaurant?.deliveryPricingConfig?.customerDeliveryRates;
  const hasConfiguredGrid = Array.isArray(orderSlabs) && orderSlabs.length > 0 &&
    Array.isArray(rates) && rates.length > 0;
  return hasConfiguredGrid;
};

const isInRange = (value, min, max) => {
  if (value < min) return false;
  if (max === null || max === undefined) return true;
  return value <= max;
};

const isValidCoordinatePair = (lat, lng) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false;
  if (Math.abs(nLat) > 90 || Math.abs(nLng) > 180) return false;
  // Treat default empty-point coordinates as invalid.
  if (nLat === 0 && nLng === 0) return false;
  return true;
};

const extractLatLng = (entity, candidates = []) => {
  for (const c of candidates) {
    const scope = c.path ? c.path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), entity) : entity;
    if (!scope) continue;

    // GeoJSON [lng, lat]
    if (Array.isArray(scope.coordinates) && scope.coordinates.length >= 2) {
      const lng = Number(scope.coordinates[0]);
      const lat = Number(scope.coordinates[1]);
      if (isValidCoordinatePair(lat, lng)) return { lat, lng };
    }

    // Explicit latitude/longitude
    if (scope.latitude != null && scope.longitude != null) {
      const lat = Number(scope.latitude);
      const lng = Number(scope.longitude);
      if (isValidCoordinatePair(lat, lng)) return { lat, lng };
    }
  }
  return null;
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

const calculateAdminCouponDiscount = (subtotal, coupon) => {
  if (!coupon) return 0;

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = Number(subtotal || 0) * (Number(coupon.discountValue || 0) / 100);
  } else {
    discount = Number(coupon.discountValue || 0);
  }

  const maxDiscountAmount = Number(coupon.maxDiscountAmount);
  if (Number.isFinite(maxDiscountAmount) && maxDiscountAmount > 0) {
    discount = Math.min(discount, maxDiscountAmount);
  }

  return roundCurrency(Math.max(0, Math.min(discount, Number(subtotal || 0))));
};

const getDeliveredOrderCountForUser = async (userId) => {
  if (!userId) return 0;
  return Order.countDocuments({
    userId,
    status: 'delivered'
  });
};

const isAdminCouponValidForUser = ({
  coupon,
  deliveredOrderCount,
  subtotal,
  enforceMinOrder = false,
}) => {
  if (!coupon || coupon.status !== 'active') return false;

  const now = new Date();
  const validFrom = coupon.validFrom ? new Date(coupon.validFrom) : null;
  const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;

  if (validFrom && validFrom > now) return false;
  if (validUntil && validUntil < now) return false;
  if (coupon.eligibilityType === 'first_delivered_order' && deliveredOrderCount > 0) {
    return false;
  }
  if (enforceMinOrder && Number(subtotal || 0) < Number(coupon.minOrderValue || 0)) {
    return false;
  }

  return true;
};

const getAvailableAdminCoupons = async ({
  userId,
  subtotal,
  locale = DEFAULT_LOCALE,
}) => {
  if (!userId) return [];

  const deliveredOrderCount = await getDeliveredOrderCountForUser(userId);
  const now = new Date();
  const normalizedLocale = normalizeLocale(locale);

  const coupons = await AdminCoupon.find({
    status: 'active',
    validFrom: { $lte: now },
    $or: [
      { validUntil: { $gte: now } },
      { validUntil: null }
    ]
  })
    .sort({ createdAt: -1 })
    .lean();

  return coupons
    .filter((coupon) => isAdminCouponValidForUser({
      coupon,
      deliveredOrderCount,
      subtotal,
      enforceMinOrder: false,
    }))
    .map((coupon) => ({
      code: coupon.code,
      title: resolveLocalizedText(coupon.localizedTitle, normalizedLocale, coupon.title || ''),
      description: resolveLocalizedText(coupon.localizedDescription, normalizedLocale, coupon.description || ''),
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue || 0),
      discountPreview: calculateAdminCouponDiscount(subtotal, coupon),
      maxDiscountAmount: coupon.maxDiscountAmount ?? null,
      minOrderValue: Number(coupon.minOrderValue || 0),
      eligibilityType: coupon.eligibilityType,
      validUntil: coupon.validUntil || null,
    }));
};

const findOrderValueSlab = (orderValueSlabs, subtotal) => {
  if (!Array.isArray(orderValueSlabs) || orderValueSlabs.length === 0) return null;

  const sortedSlabs = [...orderValueSlabs].sort((a, b) => Number(a.minOrderValue || 0) - Number(b.minOrderValue || 0));
  const exactMatch = sortedSlabs.find((slab) =>
    isInRange(
      subtotal,
      Number(slab.minOrderValue || 0),
      slab.maxOrderValue === null || slab.maxOrderValue === undefined ? null : Number(slab.maxOrderValue)
    )
  );
  if (exactMatch) return exactMatch;

  // Fallback behavior:
  // If slabs are configured but there is a gap/misaligned min value (e.g. first slab starts at 149
  // and cart is 120), pick the nearest applicable slab instead of charging zero delivery.
  const firstSlab = sortedSlabs[0] || null;
  if (!firstSlab) return null;
  if (subtotal < Number(firstSlab.minOrderValue || 0)) return firstSlab;

  // For in-between gaps, use the nearest lower slab by minOrderValue.
  let nearestLower = firstSlab;
  for (const slab of sortedSlabs) {
    const min = Number(slab.minOrderValue || 0);
    if (min <= subtotal) {
      nearestLower = slab;
    } else {
      break;
    }
  }
  return nearestLower || firstSlab;
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
  const restaurantPoint = extractLatLng(restaurant, [
    { path: 'location' },
    { path: 'onboarding.step1.location' },
    { path: '' },
  ]);
  const deliveryPoint = extractLatLng(deliveryAddress, [
    { path: 'location' },
    { path: '' },
    { path: 'currentLocation' },
  ]);

  if (!restaurantPoint || !deliveryPoint) return null;
  return calculateDistance(
    [restaurantPoint.lng, restaurantPoint.lat],
    [deliveryPoint.lng, deliveryPoint.lat]
  );
};

const resolveTierAndZone = async (restaurant) => {
  let zone = null;
  let zoneTierId = null;
  const restaurantTierId = restaurant?.tierId ? String(restaurant.tierId) : null;

  if (restaurant?.zoneId) {
    zone = await Zone.findById(restaurant.zoneId).lean();
    zoneTierId = zone?.tierId ? String(zone.tierId) : null;
  }

  const tierMismatchDetected = Boolean(zoneTierId && restaurantTierId && zoneTierId !== restaurantTierId);
  if (tierMismatchDetected) {
    console.warn(
      `[calculateOrderPricing] Tier mismatch detected for restaurant ${restaurant?._id || restaurant?.restaurantId || 'unknown'}: zone.tierId=${zoneTierId}, restaurant.tierId=${restaurantTierId}`
    );
  }

  let resolvedTierId = zoneTierId || restaurantTierId || null;

  // Self-heal for pricing path:
  // if tier mapping is missing but restaurant has a valid pin, resolve zone/tier by location.
  if (!resolvedTierId && restaurant?.location) {
    try {
      const relink = await resolveZoneAndTierForLocation(restaurant.location);
      const relinkZoneId = relink?.zoneId ? String(relink.zoneId) : null;
      const relinkTierId = relink?.tierId ? String(relink.tierId) : null;
      if (relinkTierId) {
        resolvedTierId = relinkTierId;
        if (restaurant?._id) {
          Restaurant.findByIdAndUpdate(
            restaurant._id,
            {
              $set: {
                zoneId: relinkZoneId || null,
                tierId: relinkTierId
              }
            },
            { new: false }
          ).catch((err) => {
            console.warn(`[calculateOrderPricing] Failed to persist zone/tier relink for restaurant ${restaurant._id}: ${err.message}`);
          });
        }
      }
    } catch (err) {
      console.warn(`[calculateOrderPricing] Zone/tier relink by location failed: ${err.message}`);
    }
  }

  if (!resolvedTierId) {
    return { zone, tier: null, tierResolutionSource: null, tierMismatchDetected };
  }

  const tier = await Tier.findById(resolvedTierId).lean();
  return {
    zone,
    tier,
    tierResolutionSource: zoneTierId ? 'zone' : 'restaurant',
    tierMismatchDetected
  };
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
      adminDeliveryCost: roundCurrency(tierBasePay),
      usedTierBasePay: tierBasePay > 0,
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
  // Tier wise platform fee should be stored on the Tier itself.
  // Fallback to FeeSettings if tier doesn't have the value (legacy safety).
  if (tier?.platformFee !== undefined && tier?.platformFee !== null) {
    return Number(tier.platformFee);
  }
  return Number(defaultPlatformFee || 0);
};

/**
 * Calculate customer GST breakdown.
 * GST is collected on:
 * - food subtotal after discount at 5%
 * - delivery fee at 18%
 * - platform fee at 18%
 */
const calculateCustomerGSTBreakdown = ({
  subtotal = 0,
  discount = 0,
  deliveryFee = 0,
  platformFee = 0,
}) => {
  const taxableFoodAmount = Math.max(Number(subtotal || 0) - Number(discount || 0), 0);
  const foodGst = roundCurrency(taxableFoodAmount * 0.05);
  const deliveryGst = roundCurrency(Number(deliveryFee || 0) * 0.18);
  const platformGst = roundCurrency(Number(platformFee || 0) * 0.18);
  const total = roundCurrency(foodGst + deliveryGst + platformGst);

  return {
    taxableFoodAmount: roundCurrency(taxableFoodAmount),
    foodGst,
    deliveryGst,
    platformGst,
    total,
  };
};

/**
 * Backward-compatible GST helper.
 * If legacy restaurant/fee settings arguments are passed, preserve the old flow.
 * New billing flow should use `calculateCustomerGSTBreakdown` directly.
 */
export const calculateGST = async (
  subtotal,
  discount = 0,
  thirdArg = 0,
  fourthArg = 0,
  fifthArg = 0,
  sixthArg = 0
) => {
  const looksLikeLegacyRestaurantArg = thirdArg && typeof thirdArg === 'object' && !Array.isArray(thirdArg);
  if (looksLikeLegacyRestaurantArg) {
    const restaurant = thirdArg;
    const passedFeeSettings = fourthArg;
    const taxableAmount = Math.max(Number(subtotal || 0) - Number(discount || 0), 0);
    const feeSettings = passedFeeSettings || await getFeeSettings();
    const gstRate = (feeSettings.gstRate || 5) / 100;

    const isRegistered = restaurant?.onboarding?.step3?.gst?.isRegistered || false;
    if (isRegistered) {
      return 0;
    }

    return roundCurrency(taxableAmount * gstRate);
  }

  return calculateCustomerGSTBreakdown({
    subtotal,
    discount,
    deliveryFee: thirdArg,
    platformFee: fourthArg,
  }).total;
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
  userId = null,
  locale = DEFAULT_LOCALE,
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
    let availableAdminCoupons = [];
    const normalizedCouponCode = normalizeCouponCode(couponCode);
    const normalizedLocale = normalizeLocale(locale);

    if (restaurant) {
      try {
        let restaurantObjectId = restaurant._id;
        if (!restaurantObjectId && mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
          restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
        }

        if (restaurantObjectId) {
          const now = new Date();

          if (normalizedCouponCode) {
            const offer = await Offer.findOne({
              restaurant: restaurantObjectId,
              status: 'active',
              'items.couponCode': normalizedCouponCode,
              startDate: { $lte: now },
              $or: [
                { endDate: { $gte: now } },
                { endDate: null }
              ]
            }).lean();

            if (offer) {
              const couponItem = offer.items.find(item => item.couponCode === normalizedCouponCode);
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
                    code: normalizedCouponCode,
                    discount: discount,
                    discountPercentage: couponItem.discountPercentage,
                    minOrder: offer.minOrderValue || 0,
                    type: offer.discountType === 'percentage' ? 'percentage' : 'flat',
                    itemId: couponItem.itemId,
                    itemName: couponItem.itemName,
                    originalPrice: couponItem.originalPrice,
                    discountedPrice: couponItem.discountedPrice,
                    source: 'restaurant',
                  };
                  offerForCoupon = offer;
                }
              }
            }

            if (!appliedCoupon) {
              const [deliveredOrderCount, adminCoupon] = await Promise.all([
                getDeliveredOrderCountForUser(userId),
                AdminCoupon.findOne({
                  code: normalizedCouponCode,
                  status: 'active',
                  validFrom: { $lte: now },
                  $or: [
                    { validUntil: { $gte: now } },
                    { validUntil: null }
                  ]
                }).lean()
              ]);

              if (adminCoupon && isAdminCouponValidForUser({
                coupon: adminCoupon,
                deliveredOrderCount,
                subtotal,
                enforceMinOrder: true,
              })) {
                discount = calculateAdminCouponDiscount(subtotal, adminCoupon);
                appliedCoupon = {
                  code: normalizedCouponCode,
                  discount,
                  minOrder: adminCoupon.minOrderValue || 0,
                  type: adminCoupon.discountType,
                  title: resolveLocalizedText(
                    adminCoupon.localizedTitle,
                    normalizedLocale,
                    adminCoupon.title || ''
                  ),
                  source: 'admin',
                };
              }
            }
          }

          availableAdminCoupons = await getAvailableAdminCoupons({
            userId,
            subtotal,
            locale: normalizedLocale,
          });
        }
      } catch (error) {
        console.error(`Error fetching coupon from database: ${error.message}`);
      }
    }

    const feeSettings = await getFeeSettings();
    const {
      tier,
      tierResolutionSource,
      tierMismatchDetected
    } = await resolveTierAndZone(restaurant);
    const distanceKmRaw = calculateDistanceFromAddresses(restaurant, deliveryAddress);
    const distanceKm = Number.isFinite(distanceKmRaw) ? roundCurrency(distanceKmRaw) : 0;

    const tierDistanceSlabs = getTierDistanceSlabs(tier);
    // If a new tier was created before FeeSettings distance slabs were configured,
    // fall back to FeeSettings defaults so delivery fee computation doesn't become 0.
    const distanceSlabs = Array.isArray(tierDistanceSlabs) && tierDistanceSlabs.length > 0
      ? tierDistanceSlabs
      : feeSettings.distanceSlabs;
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
    const adminDeliveryGst = roundCurrency(adminDeliveryCost * 0.18);

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
      const tierFreeThreshold = tier?.deliveryPricing?.freeDeliveryThreshold;
      const threshold = Number.isFinite(Number(tierFreeThreshold))
        ? Number(tierFreeThreshold)
        : Number(feeSettings.freeDeliveryThreshold || 0);
      if (threshold > 0 && netAfterDiscount >= threshold) {
        finalCustomerDeliveryFee = 0;
        freeDeliveryReason = 'threshold';
      }
    }

    const gstBreakdown = calculateCustomerGSTBreakdown({
      subtotal,
      discount,
      deliveryFee: finalCustomerDeliveryFee,
      platformFee,
    });
    const gst = gstBreakdown.total;

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
    const restaurantPayableToAdmin = roundCurrency(adminDeliveryCost + adminDeliveryGst + platformFee + gst);
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
      if (!Number.isFinite(distanceKmRaw)) {
        pricingDiagnostics.push({
          code: 'MISSING_DISTANCE_COORDS',
          message: 'Distance could not be resolved from restaurant/address coordinates. Verify saved address coordinates.',
        });
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
      gstBreakdown,
      total,
      customerPayableTotal: total,
      savings,
      internalRecommendedFee: roundCurrency(internalRecommendedFee),
      internalAdminDeliveryCost: adminDeliveryCost,
      adminDeliveryGst,
      restaurantPayableToAdmin,
      gstCollected: gst,
      distanceKm,
      appliedCoupon: appliedCoupon ? {
        code: appliedCoupon.code,
        discount: discount,
        freeDelivery: freeDeliveryReason === 'coupon' || freeDeliveryReason === 'threshold',
        source: appliedCoupon.source || 'restaurant',
      } : null,
      availableAdminCoupons,
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
        tierResolutionSource,
        tierMismatchDetected,
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
