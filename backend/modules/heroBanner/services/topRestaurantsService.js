import Restaurant from '../../restaurant/models/Restaurant.js';
import Menu from '../../restaurant/models/Menu.js';
import Order from '../../order/models/Order.js';
import Zone from '../../admin/models/Zone.js';
import { calculateDistance } from '../../order/services/orderCalculationService.js';

const TOP_RESTAURANTS_LIMIT = 10;
const DEFAULT_OFFER_VALUES = new Set([
  'Flat ₹50 OFF above ₹199',
  'Flat 50% OFF',
  'Flat ₹40 OFF above ₹149'
]);

const buildEligibleRestaurantQuery = (activeZoneIds) => ({
  isActive: true,
  isAcceptingOrders: true,
  zoneId: { $in: activeZoneIds },
  $or: [
    { businessModel: 'Commission Base' },
    {
      businessModel: { $ne: 'Commission Base' },
      'subscription.status': 'active',
      'subscription.endDate': { $gt: new Date() }
    }
  ]
});

const getRestaurantCoordinates = (restaurant) => {
  const lat = restaurant.location?.latitude ?? restaurant.location?.coordinates?.[1];
  const lng = restaurant.location?.longitude ?? restaurant.location?.coordinates?.[0];

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return null;
  }

  return {
    lat: Number(lat),
    lng: Number(lng)
  };
};

export const getTopRestaurantsForUser = async ({
  latitude,
  longitude,
  zoneId,
  pureVeg,
  limit = TOP_RESTAURANTS_LIMIT
} = {}) => {
  const userLat = latitude != null ? parseFloat(latitude) : null;
  const userLng = longitude != null ? parseFloat(longitude) : null;
  const hasGeoFilter = Number.isFinite(userLat) && Number.isFinite(userLng);

  const activeZones = await Zone.find({ isActive: true }).select('_id').lean();
  const activeZoneIds = activeZones.map((zone) => zone._id);

  if (activeZoneIds.length === 0) {
    return {
      restaurants: [],
      status: 'OUT_OF_SERVICE'
    };
  }

  const query = buildEligibleRestaurantQuery(activeZoneIds);
  const pureVegOnly = pureVeg === 'true' || pureVeg === true;

  if (pureVegOnly) {
    const nonVegOrEggPattern = /^(non[-\s]?veg|egg)$/i;
    const nonVegRestaurantIds = await Menu.distinct('restaurant', {
      isActive: true,
      $or: [
        { 'sections.foodType': { $regex: nonVegOrEggPattern } },
        { 'sections.items.foodType': { $regex: nonVegOrEggPattern } },
        { 'sections.subsections.items.foodType': { $regex: nonVegOrEggPattern } }
      ]
    });
    if (nonVegRestaurantIds.length > 0) {
      query._id = { $nin: nonVegRestaurantIds };
    }
  }

  if (zoneId) {
    const normalizedZoneId = String(zoneId);
    if (activeZoneIds.some((id) => String(id) === normalizedZoneId)) {
      query.zoneId = zoneId;
    }
  }

  const restaurants = await Restaurant.find(query)
    .select('name slug restaurantId profileImage coverImages menuImages cuisines estimatedDeliveryTime distance offer featuredDish featuredPrice location deliveryRange zoneId')
    .lean();

  let eligibleRestaurants = restaurants;

  if (hasGeoFilter) {
    eligibleRestaurants = restaurants.filter((restaurant) => {
      const coordinates = getRestaurantCoordinates(restaurant);
      if (!coordinates) {
        return false;
      }

      const distanceKm = calculateDistance([coordinates.lng, coordinates.lat], [userLng, userLat]);
      const rangeKm = Number(restaurant.deliveryRange) || 5;
      return distanceKm <= rangeKm;
    });
  }

  if (eligibleRestaurants.length === 0) {
    return {
      restaurants: []
    };
  }

  const deliveredOrderCounts = await Order.aggregate([
    {
      $match: {
        status: 'delivered',
        'review.rating': { $exists: true, $ne: null },
        restaurantId: {
          $in: eligibleRestaurants
            .map((restaurant) => String(restaurant._id))
            .filter(Boolean)
        }
      }
    },
    {
      $group: {
        _id: '$restaurantId',
        completedOrders: { $sum: 1 },
        averageRating: { $avg: '$review.rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);

  const reviewStatsByRestaurantId = new Map(
    deliveredOrderCounts.map((entry) => [
      String(entry._id),
      {
        completedOrders: Number(entry.completedOrders || 0),
        averageRating: Number(entry.averageRating || 0),
        totalRatings: Number(entry.totalRatings || 0)
      }
    ])
  );

  const rankedRestaurants = eligibleRestaurants
    .map((restaurant) => {
      const reviewStats = reviewStatsByRestaurantId.get(String(restaurant._id)) || null;
      const normalizedOffer = typeof restaurant.offer === 'string' ? restaurant.offer.trim() : null;

      return {
        ...restaurant,
        rating: reviewStats && reviewStats.totalRatings > 0
          ? Number(reviewStats.averageRating.toFixed(1))
          : null,
        totalRatings: reviewStats?.totalRatings || 0,
        completedOrders: reviewStats?.completedOrders || 0,
        offer: normalizedOffer && !DEFAULT_OFFER_VALUES.has(normalizedOffer) ? normalizedOffer : null
      };
    })
    .sort((a, b) => {
      const ratingDiff = Number(b.rating ?? -1) - Number(a.rating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;

      const completedOrdersDiff = Number(b.completedOrders || 0) - Number(a.completedOrders || 0);
      if (completedOrdersDiff !== 0) return completedOrdersDiff;

      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .slice(0, limit);

  return {
    restaurants: rankedRestaurants
  };
};
