import Offer from '../models/Offer.js';
import Restaurant from '../models/Restaurant.js';
import Order from '../../order/models/Order.js';
import mongoose from 'mongoose';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { calculateDistance } from '../../order/services/orderCalculationService.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeOfferEndForComparison = (endDate) => {
  if (!endDate) return null;
  const normalized = new Date(endDate);
  if (
    normalized.getHours() === 0 &&
    normalized.getMinutes() === 0 &&
    normalized.getSeconds() === 0 &&
    normalized.getMilliseconds() === 0
  ) {
    normalized.setHours(23, 59, 59, 999);
  }
  return normalized;
};

const isOfferActiveForCurrentTime = (offer, now = new Date()) => {
  const startDate = offer?.startDate ? new Date(offer.startDate) : null;
  const endDate = normalizeOfferEndForComparison(offer?.endDate);
  const startValid = !startDate || startDate <= now;
  const endValid = !endDate || endDate >= now;
  return startValid && endValid;
};

const normalizeItemId = (value) => String(value ?? '').trim();

const isSameItemId = (left, right) => {
  const a = normalizeItemId(left);
  const b = normalizeItemId(right);
  return Boolean(a && b && a === b);
};

const formatPeriodLabel = (start, end, mode) => {
  const opts = { day: '2-digit', month: 'short' };
  const startLabel = start.toLocaleDateString('en-IN', opts);
  const endLabel = end.toLocaleDateString('en-IN', opts);
  if (mode === 'daily') return `Daily (${endLabel})`;
  if (mode === 'monthly') return `Monthly (${startLabel} - ${endLabel})`;
  return `Weekly (${startLabel} - ${endLabel})`;
};

const getPeriodWindow = (mode = 'weekly', now = new Date()) => {
  const normalizedMode = ['daily', 'weekly', 'monthly'].includes(mode) ? mode : 'weekly';
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let days = 7;
  if (normalizedMode === 'daily') days = 1;
  if (normalizedMode === 'monthly') days = 30;

  const start = new Date(end.getTime() - (days - 1) * MS_IN_DAY);
  start.setHours(0, 0, 0, 0);

  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * MS_IN_DAY);
  prevStart.setHours(0, 0, 0, 0);
  prevEnd.setHours(23, 59, 59, 999);

  return {
    mode: normalizedMode,
    start,
    end,
    prevStart,
    prevEnd
  };
};

const normalizeOfferStatusForUI = (offer, now = new Date()) => {
  const status = String(offer?.status || '').toLowerCase();
  const startDate = offer?.startDate ? new Date(offer.startDate) : null;
  const endDate = offer?.endDate ? new Date(offer.endDate) : null;

  if (status === 'active') {
    if (startDate && startDate > now) return 'scheduled';
    if (endDate && endDate < now) return 'inactive';
    return 'active';
  }
  return 'inactive';
};

// Create/Activate offer
export const createOffer = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const {
    goalId,
    discountType,
    items = [],
    customerGroup = 'all',
    offerPreference = 'all',
    offerDays = 'all',
    startDate,
    endDate,
    targetMealtime = 'all',
    minOrderValue = 0,
    maxLimit = null,
    discountCards = [],
    priceCards = [],
    discountConstruct = '',
    freebieItems = []
  } = req.body;

  // Validate required fields
  if (!goalId || !discountType) {
    return errorResponse(res, 400, 'goalId and discountType are required');
  }

  // For percentage discounts, items are required
  if (discountType === 'percentage' && (!items || items.length === 0)) {
    return errorResponse(res, 400, 'At least one item is required for percentage discount');
  }

  // Validate each item has required fields
  if (items.length > 0) {
    for (const item of items) {
      if (!item.itemId || !item.itemName || item.originalPrice === undefined || item.discountPercentage === undefined || !item.couponCode) {
        return errorResponse(res, 400, 'Each item must have itemId, itemName, originalPrice, discountPercentage, and couponCode');
      }
    }
  }

  // Create offer
  const offerData = {
    restaurant: restaurantId,
    goalId,
    discountType,
    items,
    customerGroup,
    offerPreference,
    offerDays,
    targetMealtime,
    minOrderValue,
    maxLimit,
    discountCards,
    priceCards,
    discountConstruct,
    freebieItems,
    status: 'active',
    // Automatically activate
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null
  };
  const offer = await Offer.create(offerData);
  return successResponse(res, 201, 'Offer created and activated successfully', {
    offer
  });
});

// Get all offers for restaurant
export const getOffers = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const {
    status,
    goalId,
    discountType
  } = req.query;
  const query = {
    restaurant: restaurantId
  };
  const normalizedStatus = status ? String(status).toLowerCase() : '';
  const dbStatuses = ['draft', 'active', 'paused', 'expired', 'cancelled'];
  const uiBucketStatuses = ['active', 'scheduled', 'inactive'];
  const isUiBucketStatus = uiBucketStatuses.includes(normalizedStatus);
  const isDbStatus = dbStatuses.includes(normalizedStatus);

  // Keep backward compatibility for real DB statuses and support UI buckets.
  if (normalizedStatus && isDbStatus && !isUiBucketStatus) {
    query.status = normalizedStatus;
  }
  if (goalId) {
    query.goalId = goalId;
  }
  if (discountType) {
    query.discountType = discountType;
  }
  let offers = await Offer.find(query).sort({
    createdAt: -1
  }).lean();

  // Support UI status buckets without breaking existing raw status filters.
  if (isUiBucketStatus) {
    const now = new Date();
    const wanted = normalizedStatus;
    offers = offers.filter((offer) => normalizeOfferStatusForUI(offer, now) === wanted);
  }

  offers = offers.map((offer) => ({
    ...offer,
    uiStatus: normalizeOfferStatusForUI(offer, new Date())
  }));

  return successResponse(res, 200, 'Offers retrieved successfully', {
    offers,
    total: offers.length
  });
});

// Offer performance analytics for restaurant growth > track offers
export const getOfferPerformance = asyncHandler(async (req, res) => {
  const restaurantId = String(req.restaurant._id);
  const mode = req.query?.dateFormat || 'weekly';
  const now = new Date();
  const {
    mode: normalizedMode,
    start,
    end,
    prevStart,
    prevEnd
  } = getPeriodWindow(mode, now);

  const baseOrderQuery = {
    restaurantId,
    status: { $nin: ['cancelled', 'failed', 'refunded'] },
    'pricing.couponSource': 'restaurant',
    'pricing.couponCode': { $exists: true, $ne: null }
  };

  const currentOrders = await Order.find({
    ...baseOrderQuery,
    createdAt: { $gte: start, $lte: end }
  }).select('pricing').lean();

  const previousOrders = await Order.find({
    ...baseOrderQuery,
    createdAt: { $gte: prevStart, $lte: prevEnd }
  }).select('pricing').lean();

  const toMetrics = (orders) => {
    const grossSales = round2(orders.reduce((acc, order) => acc + Number(order?.pricing?.subtotal || 0), 0));
    const ordersCount = Number(orders.length || 0);
    const discountGiven = round2(orders.reduce((acc, order) => acc + Number(order?.pricing?.discount || 0), 0));
    const effectiveDiscount = grossSales > 0 ? round2((discountGiven / grossSales) * 100) : 0;
    return {
      grossSales,
      ordersFromOffers: ordersCount,
      discountGiven,
      effectiveDiscount
    };
  };

  const current = toMetrics(currentOrders);
  const previous = toMetrics(previousOrders);

  const getChangePercent = (cur, prev) => {
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return 0;
    if (prev === 0) return cur > 0 ? 100 : 0;
    return round2(((cur - prev) / prev) * 100);
  };

  const offerDocs = await Offer.find({ restaurant: restaurantId }).select('status startDate endDate').lean();
  const groupedOffers = {
    active: 0,
    scheduled: 0,
    inactive: 0
  };
  offerDocs.forEach((offer) => {
    const key = normalizeOfferStatusForUI(offer, now);
    groupedOffers[key] = Number(groupedOffers[key] || 0) + 1;
  });

  // Menu-open tracking is not available in current backend data model.
  const menuToOrder = 0;
  const previousMenuToOrder = 0;

  return successResponse(res, 200, 'Offer performance retrieved successfully', {
    period: {
      dateFormat: normalizedMode,
      start,
      end,
      label: formatPeriodLabel(start, end, normalizedMode),
      comparisonLabel: normalizedMode === 'daily'
        ? `previous day (${prevEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`
        : `${normalizedMode === 'monthly' ? 'previous month' : 'previous week'} (${prevStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${prevEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})`
    },
    metrics: {
      grossSalesFromOffers: {
        value: current.grossSales,
        changePercent: getChangePercent(current.grossSales, previous.grossSales)
      },
      ordersFromOffers: {
        value: current.ordersFromOffers,
        changePercent: getChangePercent(current.ordersFromOffers, previous.ordersFromOffers)
      },
      discountGiven: {
        value: current.discountGiven,
        changePercent: getChangePercent(current.discountGiven, previous.discountGiven)
      },
      effectiveDiscount: {
        value: current.effectiveDiscount,
        changePercent: getChangePercent(current.effectiveDiscount, previous.effectiveDiscount)
      },
      menuToOrder: {
        value: menuToOrder,
        changePercent: getChangePercent(menuToOrder, previousMenuToOrder),
        unavailable: true
      }
    },
    offers: groupedOffers
  });
});

// Get offer by ID
export const getOfferById = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const {
    id
  } = req.params;
  const offer = await Offer.findOne({
    _id: id,
    restaurant: restaurantId
  }).lean();
  if (!offer) {
    return errorResponse(res, 404, 'Offer not found');
  }
  return successResponse(res, 200, 'Offer retrieved successfully', {
    offer
  });
});

// Update offer status (activate, pause, cancel)
export const updateOfferStatus = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const {
    id
  } = req.params;
  const {
    status
  } = req.body;
  if (!status || !['active', 'paused', 'cancelled'].includes(status)) {
    return errorResponse(res, 400, 'Valid status (active, paused, cancelled) is required');
  }
  const offer = await Offer.findOneAndUpdate({
    _id: id,
    restaurant: restaurantId
  }, {
    status
  }, {
    new: true
  });
  if (!offer) {
    return errorResponse(res, 404, 'Offer not found');
  }
  return successResponse(res, 200, `Offer ${status} successfully`, {
    offer
  });
});

// Delete offer
export const deleteOffer = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const {
    id
  } = req.params;
  const offer = await Offer.findOneAndDelete({
    _id: id,
    restaurant: restaurantId
  });
  if (!offer) {
    return errorResponse(res, 404, 'Offer not found');
  }
  return successResponse(res, 200, 'Offer deleted successfully');
});

// Get coupons for a specific item/dish
export const getCouponsByItemId = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const {
    itemId
  } = req.params;
  if (!itemId) {
    return errorResponse(res, 400, 'Item ID is required');
  }
  const now = new Date();
  // Debug: Check all offers for this restaurant
  const allRestaurantOffers = await Offer.find({
    restaurant: restaurantId,
    status: 'active'
  }).select('items discountType minOrderValue startDate endDate status').lean();
  allRestaurantOffers.forEach(offer => {
    offer.items?.forEach((item, idx) => {});
  });

  // Find all active offers that include this item
  const allOffers = await Offer.find({
    restaurant: restaurantId,
    status: 'active'
  }).select('items discountType minOrderValue startDate endDate status').lean();
  // Filter by date validity
  const validOffers = allOffers.filter((offer) => isOfferActiveForCurrentTime(offer, now));
  // Extract coupons for this specific item
  const coupons = [];
  validOffers.forEach(offer => {
    offer.items.forEach((item, idx) => {
      if (isSameItemId(item.itemId, itemId)) {
        const coupon = {
          couponCode: item.couponCode,
          discountPercentage: item.discountPercentage,
          originalPrice: item.originalPrice,
          discountedPrice: item.discountedPrice,
          minOrderValue: offer.minOrderValue || 0,
          discountType: offer.discountType,
          startDate: offer.startDate,
          endDate: offer.endDate
        };
        coupons.push(coupon);
      }
    });
  });
  return successResponse(res, 200, 'Coupons retrieved successfully', {
    coupons,
    total: coupons.length
  });
});

// Get coupons for a specific item/dish (PUBLIC - for user cart)
export const getCouponsByItemIdPublic = asyncHandler(async (req, res) => {
  const {
    itemId,
    restaurantId
  } = req.params;
  if (!itemId || !restaurantId) {
    return errorResponse(res, 400, 'Item ID and Restaurant ID are required');
  }
  const now = new Date();
  // Find restaurant by ID, slug, or restaurantId to get the actual MongoDB _id
  let restaurantObjectId = null;

  // Try to find restaurant first
  try {
    const restaurantQuery = {};

    // Check if restaurantId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
      restaurantQuery._id = new mongoose.Types.ObjectId(restaurantId);
    } else {
      // Try restaurantId field or slug
      restaurantQuery.$or = [{
        restaurantId: restaurantId
      }, {
        slug: restaurantId
      }];
    }
    const restaurant = await Restaurant.findOne(restaurantQuery).select('_id').lean();
    if (restaurant) {
      restaurantObjectId = restaurant._id;
    } else {
      return successResponse(res, 200, 'No coupons found', {
        coupons: [],
        total: 0
      });
    }
  } catch (error) {
    console.error(`[COUPONS-PUBLIC] Error finding restaurant:`, error);
    return errorResponse(res, 500, `Error finding restaurant: ${error.message}`);
  }

  // Find all active offers that include this item for this restaurant
  const allOffers = await Offer.find({
    restaurant: restaurantObjectId,
    status: 'active'
  }).select('items discountType minOrderValue startDate endDate status').lean();
  // Filter by date validity
  const validOffers = allOffers.filter((offer) => isOfferActiveForCurrentTime(offer, now));
  // Extract coupons for this specific item
  const coupons = [];
  validOffers.forEach(offer => {
    offer.items.forEach(item => {
      if (isSameItemId(item.itemId, itemId)) {
        coupons.push({
          couponCode: item.couponCode,
          discountPercentage: item.discountPercentage,
          originalPrice: item.originalPrice,
          discountedPrice: item.discountedPrice,
          minOrderValue: offer.minOrderValue || 0,
          discountType: offer.discountType,
          startDate: offer.startDate,
          endDate: offer.endDate
        });
      }
    });
  });
  return successResponse(res, 200, 'Coupons retrieved successfully', {
    coupons,
    total: coupons.length
  });
});

// Get all active offers with restaurant and dish details (PUBLIC - for user offers page)
export const getPublicOffers = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const {
      latitude,
      longitude
    } = req.query;
    const userLat = latitude ? parseFloat(latitude) : null;
    const userLng = longitude ? parseFloat(longitude) : null;

    // Find all active offers
    const offers = await Offer.find({
      status: 'active'
    }).populate('restaurant', 'name restaurantId slug profileImage rating estimatedDeliveryTime distance location deliveryRange').sort({
      createdAt: -1
    }).lean();
    // Filter by date validity and flatten to show dishes with offers
    const offerDishes = [];
    offers.forEach(offer => {
      // Check if offer is valid (date-wise)
      if (!isOfferActiveForCurrentTime(offer, now)) {
        return; // Skip expired or not yet started offers
      }

      // Skip if restaurant is not found or not active
      if (!offer.restaurant || !offer.restaurant.name) {
        return;
      }

      // Range check if user location provided
      if (userLat !== null && userLng !== null) {
        const resLocation = offer.restaurant.location;
        const resLat = resLocation?.latitude || resLocation?.coordinates?.[1];
        const resLng = resLocation?.longitude || resLocation?.coordinates?.[0];
        if (resLat && resLng) {
          const dist = calculateDistance([resLng, resLat], [userLng, userLat]);
          const range = offer.restaurant.deliveryRange || 5;
          if (dist > range) {
            return; // Skip if out of delivery range
          }
        }
      }

      // Process each item in the offer
      if (offer.items && offer.items.length > 0) {
        offer.items.forEach(item => {
          // Format offer text based on discount type
          let offerText = '';
          if (offer.discountType === 'percentage') {
            offerText = `Flat ${item.discountPercentage}% OFF`;
          } else if (offer.discountType === 'flat-price') {
            const discountAmount = item.originalPrice - item.discountedPrice;
            offerText = `Flat ₹${Math.round(discountAmount)} OFF`;
          } else if (offer.discountType === 'bogo') {
            offerText = 'Buy 1 Get 1 Free';
          } else {
            offerText = 'Special Offer';
          }
          offerDishes.push({
            id: `${offer._id}_${item.itemId}`,
            restaurantId: offer.restaurant._id.toString(),
            restaurantName: offer.restaurant.name,
            restaurantSlug: offer.restaurant.slug || offer.restaurant.name.toLowerCase().replace(/\s+/g, '-'),
            restaurantImage: offer.restaurant.profileImage?.url || '',
            restaurantRating: offer.restaurant.rating || 0,
            deliveryTime: offer.restaurant.estimatedDeliveryTime || '25-30 mins',
            distance: offer.restaurant.distance || '1.2 km',
            dishId: item.itemId,
            dishName: item.itemName,
            dishImage: item.image || '',
            originalPrice: item.originalPrice,
            discountedPrice: item.discountedPrice,
            discountPercentage: item.discountPercentage,
            offer: offerText,
            couponCode: item.couponCode,
            isVeg: item.isVeg || false,
            minOrderValue: offer.minOrderValue || 0
          });
        });
      }
    });

    // Group by offer text for the "FLAT 50% OFF" section
    const groupedByOffer = {};
    offerDishes.forEach(dish => {
      if (!groupedByOffer[dish.offer]) {
        groupedByOffer[dish.offer] = [];
      }
      groupedByOffer[dish.offer].push(dish);
    });
    return successResponse(res, 200, 'Offers retrieved successfully', {
      allOffers: offerDishes,
      groupedByOffer,
      total: offerDishes.length
    });
  } catch (error) {
    console.error('[PUBLIC-OFFERS] Error fetching public offers:', error);
    console.error('[PUBLIC-OFFERS] Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch offers');
  }
});
