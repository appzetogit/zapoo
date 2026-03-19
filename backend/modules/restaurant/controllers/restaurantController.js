import Restaurant from '../models/Restaurant.js';
import Menu from '../models/Menu.js';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../shared/utils/cloudinaryService.js';
import { initializeCloudinary } from '../../../config/cloudinary.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';
import { calculateDistance } from '../../order/services/orderCalculationService.js';

/**
 * Check if a point is within a zone polygon using ray casting algorithm
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} zoneCoordinates - Zone coordinates array
 * @returns {boolean}
 */
function isPointInZone(lat, lng, zoneCoordinates) {
  if (!zoneCoordinates || zoneCoordinates.length < 3) return false;
  let inside = false;
  for (let i = 0, j = zoneCoordinates.length - 1; i < zoneCoordinates.length; j = i++) {
    const coordI = zoneCoordinates[i];
    const coordJ = zoneCoordinates[j];
    const xi = typeof coordI === 'object' ? coordI.latitude || coordI.lat : null;
    const yi = typeof coordI === 'object' ? coordI.longitude || coordI.lng : null;
    const xj = typeof coordJ === 'object' ? coordJ.latitude || coordJ.lat : null;
    const yj = typeof coordJ === 'object' ? coordJ.longitude || coordJ.lng : null;
    if (xi === null || yi === null || xj === null || yj === null) continue;
    const intersect = yi > lng !== yj > lng && lat < (xj - xi) * (lng - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a restaurant's location (pin) is within any active zone
 * @param {number} restaurantLat - Restaurant latitude
 * @param {number} restaurantLng - Restaurant longitude
 * @param {Array} activeZones - Array of active zones (cached)
 * @returns {boolean}
 */
function isRestaurantInAnyZone(restaurantLat, restaurantLng, activeZones) {
  if (!restaurantLat || !restaurantLng) return false;
  for (const zone of activeZones) {
    if (!zone.coordinates || zone.coordinates.length < 3) continue;
    let isInZone = false;
    if (typeof zone.containsPoint === 'function') {
      isInZone = zone.containsPoint(restaurantLat, restaurantLng);
    } else {
      isInZone = isPointInZone(restaurantLat, restaurantLng, zone.coordinates);
    }
    if (isInZone) {
      return true;
    }
  }
  return false;
}

/**
 * Get restaurant's zoneId based on location
 * @param {number} restaurantLat - Restaurant latitude
 * @param {number} restaurantLng - Restaurant longitude
 * @param {Array} activeZones - Array of active zones
 * @returns {string|null} Zone ID or null
 */
function getRestaurantZoneId(restaurantLat, restaurantLng, activeZones) {
  if (!restaurantLat || !restaurantLng) return null;
  for (const zone of activeZones) {
    if (!zone.coordinates || zone.coordinates.length < 3) continue;
    let isInZone = false;
    if (typeof zone.containsPoint === 'function') {
      isInZone = zone.containsPoint(restaurantLat, restaurantLng);
    } else {
      isInZone = isPointInZone(restaurantLat, restaurantLng, zone.coordinates);
    }
    if (isInZone) {
      return zone._id.toString();
    }
  }
  return null;
}

// Get all restaurants (for user module)
export const getRestaurants = async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      sortBy,
      cuisine,
      minRating,
      maxDeliveryTime,
      maxDistance,
      maxPrice,
      hasOffers,
      zoneId, // User's zone ID (optional - if provided, filters by zone)
      latitude,
      longitude
    } = req.query;
    const userLat = latitude != null ? parseFloat(latitude) : null;
    const userLng = longitude != null ? parseFloat(longitude) : null;
    const hasGeoFilter = userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng);

    // Optional: Zone-based filtering - if zoneId is provided, validate and filter by zone
    let userZone = null;
    if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
      // Zone hint is optional; ignore stale/inactive values instead of failing the listing API.
      userZone = await Zone.findById(zoneId).select('_id isActive').lean();
      if (!userZone?.isActive) {
        userZone = null;
      }
    }

    // Enforce zone presence when user location is available
    if (hasGeoFilter && !userZone) {
      return successResponse(res, 200, 'User is outside service zone', {
        restaurants: [],
        total: 0,
        status: 'OUT_OF_SERVICE',
        filters: {
          sortBy,
          cuisine,
          minRating,
          maxDeliveryTime,
          maxDistance,
          maxPrice,
          hasOffers
        }
      });
    }

    // Build query conditions array
    const queryAndConditions = [
      { isActive: true },
      {
        $or: [
          { businessModel: 'Commission Base' },
          {
            businessModel: { $ne: 'Commission Base' },
            'subscription.status': 'active',
            'subscription.endDate': { $gt: new Date() }
          }
        ]
      }
    ];

    // Cuisine filter
    if (cuisine) {
      queryAndConditions.push({
        cuisines: { $in: [new RegExp(cuisine, 'i')] }
      });
    }

    // Rating filter
    if (minRating) {
      queryAndConditions.push({
        rating: { $gte: parseFloat(minRating) }
      });
    }

    // Trust filters
    if (req.query.topRated === 'true') {
      queryAndConditions.push({
        rating: { $gte: 4.5 }
      });
    } else if (req.query.trusted === 'true') {
      queryAndConditions.push({
        rating: { $gte: 4.0 },
        totalRatings: { $gte: 100 }
      });
    }

    // Delivery time filter
    if (maxDeliveryTime) {
      queryAndConditions.push({
        avgDeliveryTime: { $lte: parseInt(maxDeliveryTime) }
      });
    }

    // Price range filter
    if (maxPrice) {
      queryAndConditions.push({
        avgPriceValue: { $lte: parseInt(maxPrice) }
      });
    }

    // Offers filter
    if (hasOffers === 'true') {
      queryAndConditions.push({
        $or: [
          { offer: { $exists: true, $ne: null, $ne: '' } },
          { featuredPrice: { $exists: true } }
        ]
      });
    }

    // Only show restaurants that belong to an active zone
    let activeZoneIds = null;
    if (userZone || hasGeoFilter) {
      const activeZones = await Zone.find({ isActive: true }).select('_id').lean();
      activeZoneIds = activeZones.map(zone => zone._id);
      if (activeZoneIds.length === 0) {
        return successResponse(res, 200, 'No active zones available', {
          restaurants: [],
          total: 0,
          status: 'OUT_OF_SERVICE',
          filters: {
            sortBy,
            cuisine,
            minRating,
            maxDeliveryTime,
            maxDistance,
            maxPrice,
            hasOffers
          }
        });
      }
      queryAndConditions.push({ zoneId: { $in: activeZoneIds } });
    }

    const query = { $and: queryAndConditions };

    // Build sort object
    let sortObj = {
      createdAt: -1
    }; // Default: Latest first

    if (sortBy) {
      switch (sortBy) {
        case 'price-low':
          sortObj = {
            avgPriceValue: 1,
            rating: -1
          }; // $ < $$ < $$$, then by rating
          break;
        case 'price-high':
          sortObj = {
            avgPriceValue: -1,
            rating: -1
          }; // $$$$ > $$$ > $$ > $, then by rating
          break;
        case 'rating-high':
          sortObj = {
            rating: -1,
            totalRatings: -1
          }; // Highest rating first
          break;
        case 'rating-low':
          sortObj = {
            rating: 1,
            totalRatings: -1
          }; // Lowest rating first
          break;
        case 'relevance':
        default:
          sortObj = {
            rating: -1,
            totalRatings: -1,
            createdAt: -1
          }; // Relevance: high rating + recent
          break;
      }
    }

    const projectionFields = {
      name: 1, slug: 1, cuisines: 1, rating: 1, totalRatings: 1, promo: 1,
      profileImage: 1, location: 1, avgDeliveryTime: 1, avgPriceValue: 1,
      isActive: 1, isAcceptingOrders: 1, featuredDish: 1, featuredPrice: 1,
      offer: 1, estimatedDeliveryTime: 1, distance: 1, deliveryRange: 1
    };

    let restaurants;
    let total = 0;

    if (hasGeoFilter) {
      const settings = await BusinessSettings.getSettings();
      const maxRangeMeters = (settings.maxDeliveryRange || 20) * 1000;

      const basePipeline = [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [userLng, userLat] },
            distanceField: "distanceMeters",
            spherical: true,
            maxDistance: maxRangeMeters,
            query: query
          }
        },
        {
          $match: {
            $expr: {
              $lte: [
                "$distanceMeters",
                { $multiply: [{ $ifNull: ["$deliveryRange", 5] }, 1000] }
              ]
            }
          }
        }
      ];

      const [restaurantsResult, countResult] = await Promise.all([
        Restaurant.aggregate([
          ...basePipeline,
          { $sort: sortObj },
          { $skip: parseInt(offset) },
          { $limit: parseInt(limit) },
          { $project: { ...projectionFields, distanceMeters: 1 } }
        ]),
        Restaurant.aggregate([
          ...basePipeline,
          { $count: "total" }
        ])
      ]);

      restaurants = restaurantsResult;
      total = countResult[0]?.total || 0;
    } else {
      const projection = 'name slug cuisines rating totalRatings promo profileImage location avgDeliveryTime avgPriceValue isActive isAcceptingOrders featuredDish featuredPrice offer estimatedDeliveryTime distance deliveryRange';
      restaurants = await Restaurant.find(query)
        .select(projection)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean();
      total = await Restaurant.countDocuments(query);
    }

    return successResponse(res, 200, 'Restaurants retrieved successfully', {
      restaurants,
      total,
      filters: {
        sortBy,
        cuisine,
        minRating,
        maxDeliveryTime,
        maxDistance,
        maxPrice,
        hasOffers
      }
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurants');
  }
};

// Get restaurant by ID or slug
// Optional query: latitude, longitude — when provided and user is beyond deliveryRange, response includes outOfRange: true
export const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.query;
    const userLat = latitude != null ? parseFloat(latitude) : null;
    const userLng = longitude != null ? parseFloat(longitude) : null;

    // Build query conditions
    const orConditions = [{
      restaurantId: id
    }, {
      slug: id
    }];

    // Only add _id condition if the id is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      orConditions.push({
        _id: new mongoose.Types.ObjectId(id)
      });
    }

    const queryConditions = {
      isActive: true,
      $and: [
        { $or: orConditions },
        {
          $or: [
            { businessModel: 'Commission Base' },
            {
              businessModel: { $ne: 'Commission Base' },
              'subscription.status': 'active',
              'subscription.endDate': { $gt: new Date() }
            }
          ]
        }
      ]
    };

    // Strict field projection for public restaurant profile
    const projection = 'name slug cuisines rating totalRatings promo profileImage location avgDeliveryTime avgPriceValue isActive isAcceptingOrders featuredDish featuredPrice offer distance deliveryRange estimatedDeliveryTime cuisines';

    const restaurant = await Restaurant.findOne(queryConditions)
      .select(projection)
      .lean();
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    let outOfRange = false;
    if (userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng)) {
      const resLocation = restaurant.location;
      const resLat = resLocation?.latitude ?? resLocation?.coordinates?.[1];
      const resLng = resLocation?.longitude ?? resLocation?.coordinates?.[0];
      if (resLat != null && resLng != null) {
        const dist = calculateDistance([resLng, resLat], [userLng, userLat]);
        const rangeKm = restaurant.deliveryRange ?? 5;
        outOfRange = dist > rangeKm;
      }
    }

    return successResponse(res, 200, 'Restaurant retrieved successfully', {
      restaurant,
      outOfRange
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurant');
  }
};

// Get restaurant by owner (for restaurant module)
export const getRestaurantByOwner = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId).lean();
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }
    return successResponse(res, 200, 'Restaurant retrieved successfully', {
      restaurant
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurant');
  }
};

// Create/Update restaurant from onboarding data
export const createRestaurantFromOnboarding = async (onboardingData, restaurantId) => {
  try {
    const {
      step1,
      step2,
      step4
    } = onboardingData;
    if (!step1 || !step2) {
      throw new Error('Incomplete onboarding data: Missing step1 or step2');
    }

    // Validate required fields
    if (!step1.restaurantName) {
      throw new Error('Restaurant name is required');
    }

    // Find existing restaurant
    const existing = await Restaurant.findById(restaurantId);
    if (!existing) {
      throw new Error('Restaurant not found');
    }

    // Generate slug from restaurant name
    let baseSlug = step1.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if slug needs to be unique (if it's different from existing)
    let slug = baseSlug;
    if (existing.slug !== baseSlug) {
      // Check if the new slug already exists for another restaurant
      const existingBySlug = await Restaurant.findOne({
        slug: baseSlug,
        _id: {
          $ne: existing._id
        }
      });
      if (existingBySlug) {
        // Make slug unique by appending a number
        let counter = 1;
        let uniqueSlug = `${baseSlug}-${counter}`;
        while (await Restaurant.findOne({
          slug: uniqueSlug,
          _id: {
            $ne: existing._id
          }
        })) {
          counter++;
          uniqueSlug = `${baseSlug}-${counter}`;
        }
        slug = uniqueSlug;
      }
    } else {
      slug = existing.slug; // Keep existing slug
    }

    // Update existing restaurant with latest onboarding data
    existing.name = step1.restaurantName || existing.name;
    existing.slug = slug;
    existing.ownerName = step1.ownerName || existing.ownerName;
    existing.ownerEmail = step1.ownerEmail || existing.ownerEmail;
    existing.ownerPhone = step1.ownerPhone || existing.ownerPhone;
    existing.primaryContactNumber = step1.primaryContactNumber || existing.primaryContactNumber;
    if (step1.location) existing.location = step1.location;

    // Update step2 data - always update even if empty arrays
    if (step2) {
      if (step2.profileImageUrl) {
        existing.profileImage = step2.profileImageUrl;
      }
      if (step2.menuImageUrls) {
        existing.menuImages = step2.menuImageUrls; // Update even if empty array
      }
      if (step2.cuisines) {
        existing.cuisines = step2.cuisines; // Update even if empty array
      }
      if (step2.deliveryTimings) {
        existing.deliveryTimings = step2.deliveryTimings;
      }
      if (step2.openDays) {
        existing.openDays = step2.openDays; // Update even if empty array
      }
    }

    // Update step4 data if available
    if (step4) {
      if (step4.estimatedDeliveryTime) existing.estimatedDeliveryTime = step4.estimatedDeliveryTime;
      if (step4.distance) existing.distance = step4.distance;
      if (step4.priceRange) existing.priceRange = step4.priceRange;
      if (step4.featuredDish) existing.featuredDish = step4.featuredDish;
      if (step4.featuredPrice !== undefined) existing.featuredPrice = step4.featuredPrice;
      if (step4.offer) existing.offer = step4.offer;
    }
    existing.isActive = true; // Ensure it's active
    existing.isAcceptingOrders = true; // Ensure it's accepting orders

    try {
      await existing.save();
    } catch (saveError) {
      if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.slug) {
        // Slug conflict - try to make it unique
        let counter = 1;
        let uniqueSlug = `${slug}-${counter}`;
        while (await Restaurant.findOne({
          slug: uniqueSlug,
          _id: {
            $ne: existing._id
          }
        })) {
          counter++;
          uniqueSlug = `${slug}-${counter}`;
        }
        existing.slug = uniqueSlug;
        await existing.save();
      } else {
        throw saveError;
      }
    }
    return existing;
  } catch (error) {
    console.error('Error creating restaurant from onboarding:', error);
    console.error('Error stack:', error.stack);
    console.error('Onboarding data received:', {
      hasStep1: !!onboardingData?.step1,
      hasStep2: !!onboardingData?.step2,
      step1Keys: onboardingData?.step1 ? Object.keys(onboardingData.step1) : [],
      step2Keys: onboardingData?.step2 ? Object.keys(onboardingData.step2) : []
    });
    throw error;
  }
};

/**
 * Update restaurant profile
 * PUT /api/restaurant/profile
 */
export const updateRestaurantProfile = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const {
      profileImage,
      menuImages,
      name,
      cuisines,
      location,
      ownerName,
      ownerEmail,
      ownerPhone,
      deliveryRange
    } = req.body;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }
    const updateData = {};

    // Update profile image if provided
    if (profileImage) {
      updateData.profileImage = profileImage;
    }

    // Update menu images if provided
    if (menuImages !== undefined) {
      updateData.menuImages = menuImages;
    }

    // Update name if provided
    if (name) {
      updateData.name = name;
      // Regenerate slug if name changed
      if (name !== restaurant.name) {
        let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check if slug already exists for another restaurant
        let slug = baseSlug;
        const existingBySlug = await Restaurant.findOne({
          slug: baseSlug,
          _id: {
            $ne: restaurantId
          }
        });
        if (existingBySlug) {
          let counter = 1;
          let uniqueSlug = `${baseSlug}-${counter}`;
          while (await Restaurant.findOne({
            slug: uniqueSlug,
            _id: {
              $ne: restaurantId
            }
          })) {
            counter++;
            uniqueSlug = `${baseSlug}-${counter}`;
          }
          slug = uniqueSlug;
        }
        updateData.slug = slug;
      }
    }

    // Update cuisines if provided
    if (cuisines !== undefined) {
      updateData.cuisines = cuisines;
    }

    // Update location if provided
    if (location) {
      // Ensure coordinates array is set if latitude/longitude exist
      if (location.latitude && location.longitude && !location.coordinates) {
        location.coordinates = [location.longitude, location.latitude]; // GeoJSON format: [lng, lat]
      }

      // If coordinates array exists but no lat/lng, extract them
      if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
        if (!location.longitude) location.longitude = location.coordinates[0];
        if (!location.latitude) location.latitude = location.coordinates[1];
      }
      updateData.location = location;

      const lat = location.latitude || location.coordinates?.[1];
      const lng = location.longitude || location.coordinates?.[0];
      if (lat && lng) {
        const activeZones = await Zone.find({ isActive: true }).lean();
        const detectedZoneId = getRestaurantZoneId(lat, lng, activeZones);
        updateData.zoneId = detectedZoneId || null;
      }
    }

    // Update owner details if provided
    if (ownerName !== undefined) {
      updateData.ownerName = ownerName;
    }
    if (ownerEmail !== undefined) {
      updateData.ownerEmail = ownerEmail;
    }
    if (ownerPhone !== undefined) {
      updateData.ownerPhone = ownerPhone;
    }
    if (deliveryRange !== undefined) {
      const rangeNum = Number(deliveryRange);
      const settings = await BusinessSettings.getSettings();
      const maxRange = settings.maxDeliveryRange || 20;
      if (rangeNum < 1 || rangeNum > maxRange) {
        return errorResponse(res, 400, `Delivery range must be between 1 and ${maxRange} km`);
      }
      updateData.deliveryRange = rangeNum;
    }

    // Update restaurant
    Object.assign(restaurant, updateData);
    await restaurant.save();
    return successResponse(res, 200, 'Restaurant profile updated successfully', {
      restaurant: {
        id: restaurant._id,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        slug: restaurant.slug,
        profileImage: restaurant.profileImage,
        menuImages: restaurant.menuImages,
        cuisines: restaurant.cuisines,
        location: restaurant.location,
        ownerName: restaurant.ownerName,
        ownerEmail: restaurant.ownerEmail,
        ownerPhone: restaurant.ownerPhone,
        deliveryRange: restaurant.deliveryRange
      }
    });
  } catch (error) {
    console.error('Error updating restaurant profile:', error);
    return errorResponse(res, 500, 'Failed to update restaurant profile');
  }
});

/**
 * Upload restaurant profile image
 * POST /api/restaurant/profile/image
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();
    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/restaurant/profile';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [{
        width: 800,
        height: 800,
        crop: 'fill',
        gravity: 'auto'
      }, {
        quality: 'auto'
      }]
    });

    // Update restaurant profile image
    restaurant.profileImage = {
      url: result.secure_url,
      publicId: result.public_id
    };
    await restaurant.save();
    return successResponse(res, 200, 'Profile image uploaded successfully', {
      profileImage: restaurant.profileImage
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return errorResponse(res, 500, 'Failed to upload profile image');
  }
});

/**
 * Upload restaurant menu image
 * POST /api/restaurant/profile/menu-image
 */
export const uploadMenuImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Validate file buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return errorResponse(res, 400, 'File buffer is empty or invalid');
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (req.file.size > maxSize) {
      return errorResponse(res, 400, `File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return errorResponse(res, 400, `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();
    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }
    // Upload to Cloudinary
    const folder = 'appzeto/restaurant/menu';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [{
        width: 1200,
        height: 800,
        crop: 'fill',
        gravity: 'auto'
      }, {
        quality: 'auto'
      }]
    });

    // Replace first menu image (main banner) or add if none exists
    if (!restaurant.menuImages) {
      restaurant.menuImages = [];
    }

    // Replace the first menu image (main banner) instead of adding a new one
    const newMenuImage = {
      url: result.secure_url,
      publicId: result.public_id
    };
    if (restaurant.menuImages.length > 0) {
      // Replace the first image (main banner)
      restaurant.menuImages[0] = newMenuImage;
    } else {
      // Add as first image if array is empty
      restaurant.menuImages.push(newMenuImage);
    }
    await restaurant.save();
    return successResponse(res, 200, 'Menu image uploaded successfully', {
      menuImage: {
        url: result.secure_url,
        publicId: result.public_id
      },
      menuImages: restaurant.menuImages
    });
  } catch (error) {
    console.error('❌ Error uploading menu image:', {
      message: error.message,
      stack: error.stack,
      errorType: error.constructor.name,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      bufferSize: req.file?.buffer?.length,
      restaurantId: req.restaurant?._id,
      cloudinaryError: error.http_code || error.name === 'Error' ? error.message : null
    });

    // Provide more specific error message
    let errorMessage = 'Failed to upload menu image';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    } else if (error.http_code) {
      errorMessage += `: Cloudinary error (${error.http_code})`;
    }
    return errorResponse(res, 500, errorMessage);
  }
});

/**
 * Get restaurant customer delivery pricing config
 * GET /api/restaurant/delivery-pricing
 */
export const getDeliveryPricingConfig = asyncHandler(async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.restaurant._id).select('deliveryPricingConfig zoneId').lean();
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }
    let distanceSlabs = [];
    let tier = null;
    if (restaurant.zoneId) {
      const zone = await Zone.findById(restaurant.zoneId).select('tierId').lean();
      if (zone?.tierId) {
        tier = await Tier.findById(zone.tierId).select('name deliveryPricing.distanceSlabs').lean();
        distanceSlabs = Array.isArray(tier?.deliveryPricing?.distanceSlabs) ? tier.deliveryPricing.distanceSlabs : [];
      }
    }
    if (!distanceSlabs.length) {
      distanceSlabs = [];
    }
    return successResponse(res, 200, 'Delivery pricing config fetched successfully', {
      deliveryPricingConfig: restaurant.deliveryPricingConfig || {
        isEnabled: false,
        orderValueSlabs: [],
        customerDeliveryRates: [],
        lastUpdatedAt: null
      },
      tier: tier ? {
        id: tier._id,
        name: tier.name
      } : null,
      distanceSlabs
    });
  } catch (error) {
    console.error('Error fetching delivery pricing config:', error);
    return errorResponse(res, 500, 'Failed to fetch delivery pricing config');
  }
});

/**
 * Update restaurant customer delivery pricing config
 * PUT /api/restaurant/delivery-pricing
 */
export const updateDeliveryPricingConfig = asyncHandler(async (req, res) => {
  try {
    const {
      isEnabled,
      orderValueSlabs,
      customerDeliveryRates
    } = req.body;
    const restaurant = await Restaurant.findById(req.restaurant._id);
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }
    let distanceSlabs = [];
    if (restaurant.zoneId) {
      const zone = await Zone.findById(restaurant.zoneId).select('tierId').lean();
      if (zone?.tierId) {
        const tier = await Tier.findById(zone.tierId).select('deliveryPricing.distanceSlabs').lean();
        distanceSlabs = Array.isArray(tier?.deliveryPricing?.distanceSlabs) ? tier.deliveryPricing.distanceSlabs : [];
      }
    }
    if (!distanceSlabs.length) {
      distanceSlabs = [];
    }
    const activeDistanceSlabs = (distanceSlabs || []).filter(s => s.isActive !== false);
    const activeDistanceSlabIds = new Set(activeDistanceSlabs.map(s => String(s._id)));
    if (!Array.isArray(orderValueSlabs) || orderValueSlabs.length === 0) {
      return errorResponse(res, 400, 'orderValueSlabs must be a non-empty array');
    }
    for (const slab of orderValueSlabs) {
      if (!slab._id) {
        return errorResponse(res, 400, 'Each order value slab must include an _id for rate mapping');
      }
      if (slab.minOrderValue === undefined || Number(slab.minOrderValue) < 0) {
        return errorResponse(res, 400, 'Each order value slab must have minOrderValue >= 0');
      }
      if (slab.maxOrderValue !== null && slab.maxOrderValue !== undefined && Number(slab.maxOrderValue) <= Number(slab.minOrderValue)) {
        return errorResponse(res, 400, 'Each order value slab maxOrderValue must be greater than minOrderValue (or null)');
      }
    }
    if (!Array.isArray(customerDeliveryRates)) {
      return errorResponse(res, 400, 'customerDeliveryRates must be an array');
    }
    const normalizedOrderValueSlabs = orderValueSlabs.map(slab => ({
      _id: slab._id,
      label: slab.label || '',
      minOrderValue: Number(slab.minOrderValue),
      maxOrderValue: slab.maxOrderValue === null || slab.maxOrderValue === undefined ? null : Number(slab.maxOrderValue)
    }));
    const orderValueSlabIds = new Set(normalizedOrderValueSlabs.map(slab => slab._id).filter(Boolean).map(id => String(id)));
    for (const rate of customerDeliveryRates) {
      const distanceSlabId = String(rate.distanceSlabId || '');
      const orderValueSlabId = String(rate.orderValueSlabId || '');
      const perKmRate = Number(rate.perKmRate);
      if (!distanceSlabId || !activeDistanceSlabIds.has(distanceSlabId)) {
        return errorResponse(res, 400, `Invalid distanceSlabId: ${distanceSlabId || '(empty)'}`);
      }
      if (!orderValueSlabId || !orderValueSlabIds.has(orderValueSlabId)) {
        return errorResponse(res, 400, `Invalid orderValueSlabId: ${orderValueSlabId || '(empty)'}`);
      }
      if (Number.isNaN(perKmRate) || perKmRate < 0) {
        return errorResponse(res, 400, 'Each delivery rate must have perKmRate >= 0');
      }
    }
    restaurant.deliveryPricingConfig = {
      isEnabled: isEnabled !== false,
      orderValueSlabs: normalizedOrderValueSlabs,
      customerDeliveryRates: customerDeliveryRates.map(rate => ({
        _id: rate._id,
        distanceSlabId: String(rate.distanceSlabId),
        orderValueSlabId: String(rate.orderValueSlabId),
        perKmRate: Number(rate.perKmRate)
      })),
      lastUpdatedAt: new Date()
    };
    await restaurant.save();
    return successResponse(res, 200, 'Delivery pricing config updated successfully', {
      deliveryPricingConfig: restaurant.deliveryPricingConfig
    });
  } catch (error) {
    console.error('Error updating delivery pricing config:', error);
    return errorResponse(res, 500, 'Failed to update delivery pricing config');
  }
});

/**
 * Update restaurant delivery status (isAcceptingOrders)
 * PUT /api/restaurant/delivery-status
 */
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const {
      isAcceptingOrders
    } = req.body;
    if (typeof isAcceptingOrders !== 'boolean') {
      return errorResponse(res, 400, 'isAcceptingOrders must be a boolean value');
    }
    const restaurant = await Restaurant.findByIdAndUpdate(restaurantId, {
      isAcceptingOrders
    }, {
      new: true
    }).select('-password');
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }
    return successResponse(res, 200, 'Delivery status updated successfully', {
      restaurant: {
        id: restaurant._id,
        isAcceptingOrders: restaurant.isAcceptingOrders
      }
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return errorResponse(res, 500, 'Failed to update delivery status');
  }
});

/**
 * Delete restaurant account
 * DELETE /api/restaurant/profile
 */
export const deleteRestaurantAccount = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Delete Cloudinary images if they exist
    try {
      // Delete profile image
      if (restaurant.profileImage?.publicId) {
        try {
          await deleteFromCloudinary(restaurant.profileImage.publicId);
        } catch (error) {
          console.error('Error deleting profile image from Cloudinary:', error);
          // Continue with account deletion even if image deletion fails
        }
      }

      // Delete menu images
      if (restaurant.menuImages && Array.isArray(restaurant.menuImages)) {
        for (const menuImage of restaurant.menuImages) {
          if (menuImage?.publicId) {
            try {
              await deleteFromCloudinary(menuImage.publicId);
            } catch (error) {
              console.error('Error deleting menu image from Cloudinary:', error);
              // Continue with account deletion even if image deletion fails
            }
          }
        }
      }
    } catch (error) {
      console.error('Error deleting images from Cloudinary:', error);
      // Continue with account deletion even if image deletion fails
    }

    // Delete the restaurant from database
    await Restaurant.findByIdAndDelete(restaurantId);
    return successResponse(res, 200, 'Restaurant account deleted successfully');
  } catch (error) {
    console.error('Error deleting restaurant account:', error);
    return errorResponse(res, 500, 'Failed to delete restaurant account');
  }
});

// Get restaurants with dishes under ₹250
export const getRestaurantsWithDishesUnder250 = async (req, res) => {
  try {
    const {
      zoneId,
      latitude,
      longitude
    } = req.query; // User's zone ID (optional); latitude/longitude for deliveryRange filter
    const userLat = latitude != null ? parseFloat(latitude) : null;
    const userLng = longitude != null ? parseFloat(longitude) : null;
    const hasGeoFilter = userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng);

    // Optional: Zone-based filtering - if zoneId is provided, validate and filter by zone
    let userZone = null;
    if (zoneId) {
      // Validate zone exists and is active
      userZone = await Zone.findById(zoneId).lean();
      if (!userZone || !userZone.isActive) {
        userZone = null;
      }
    }

    if (hasGeoFilter && !userZone) {
      return successResponse(res, 200, 'User is outside service zone', {
        restaurants: [],
        total: 0,
        status: 'OUT_OF_SERVICE'
      });
    }

    let activeZoneIds = null;
    if (userZone || hasGeoFilter) {
      const activeZones = await Zone.find({ isActive: true }).select('_id').lean();
      activeZoneIds = activeZones.map(zone => zone._id);
      if (activeZoneIds.length === 0) {
        return successResponse(res, 200, 'No active zones available', {
          restaurants: [],
          total: 0,
          status: 'OUT_OF_SERVICE'
        });
      }
    }
    const MAX_PRICE = 250;

    // Helper function to calculate final price after discount
    const getFinalPrice = item => {
      // price is typically the current/discounted price
      // If discount exists, calculate from originalPrice, otherwise use price directly
      if (item.originalPrice && item.discountAmount && item.discountAmount > 0) {
        // Calculate discounted price from originalPrice
        let discountedPrice = item.originalPrice;
        if (item.discountType === 'Percent') {
          discountedPrice = item.originalPrice - item.originalPrice * item.discountAmount / 100;
        } else if (item.discountType === 'Fixed') {
          discountedPrice = item.originalPrice - item.discountAmount;
        }
        return Math.max(0, discountedPrice);
      }
      // Otherwise, use price as the final price
      return Math.max(0, item.price || 0);
    };

    // Helper function to filter items under ₹250
    const filterItemsUnder250 = items => {
      return items.filter(item => {
        if (item.isAvailable === false) return false;
        const finalPrice = getFinalPrice(item);
        return finalPrice <= MAX_PRICE;
      });
    };

    // Get all active restaurants
    const baseQuery = { isActive: true };
    if (activeZoneIds) {
      baseQuery.zoneId = { $in: activeZoneIds };
    }

    let restaurants = await Restaurant.find(baseQuery)
      .select('-owner -createdAt -updatedAt')
      .lean()
      .limit(100);

    // Filter by deliveryRange when user coordinates provided
    if (hasGeoFilter) {
      restaurants = restaurants.filter(r => {
        const resLocation = r.location;
        const resLat = resLocation?.latitude ?? resLocation?.coordinates?.[1];
        const resLng = resLocation?.longitude ?? resLocation?.coordinates?.[0];
        if (resLat == null || resLng == null) return true;
        const dist = calculateDistance([resLng, resLat], [userLng, userLat]);
        const rangeKm = r.deliveryRange ?? 5;
        return dist <= rangeKm;
      });
    }

    // Process restaurants by bulk-fetching menus and then mapping
    const restaurantIds = restaurants.map(r => r._id);
    const allMenus = await Menu.find({
      restaurant: { $in: restaurantIds },
      isActive: true
    }).lean();

    const menuMap = new Map();
    allMenus.forEach(m => menuMap.set(m.restaurant.toString(), m));

    const restaurantsWithDishes = [];

    // Process restaurants using the pre-fetched menus
    for (const restaurant of restaurants) {
      const menu = menuMap.get(restaurant._id.toString());
      if (!menu || !menu.sections || menu.sections.length === 0) continue;

      const dishesUnder250 = [];
      menu.sections.forEach(section => {
        if (section.isEnabled === false) return;
        const sectionItems = filterItemsUnder250(section.items || []);
        dishesUnder250.push(...sectionItems.map(item => ({ ...item, sectionName: section.name })));

        (section.subsections || []).forEach(subsection => {
          const subsectionItems = filterItemsUnder250(subsection.items || []);
          dishesUnder250.push(...subsectionItems.map(item => ({ ...item, sectionName: section.name, subsectionName: subsection.name })));
        });
      });

      if (dishesUnder250.length > 0) {
        restaurantsWithDishes.push({
          id: restaurant._id.toString(),
          restaurantId: restaurant.restaurantId,
          name: restaurant.name,
          slug: restaurant.slug,
          rating: restaurant.rating || 0,
          totalRatings: restaurant.totalRatings || 0,
          deliveryTime: restaurant.estimatedDeliveryTime || "25-30 mins",
          distance: restaurant.distance || "1.2 km",
          cuisine: restaurant.cuisines?.length > 0 ? restaurant.cuisines.join(' • ') : "Multi-cuisine",
          price: restaurant.priceRange || "$$",
          image: restaurant.profileImage?.url || restaurant.menuImages?.[0]?.url || "",
          menuItems: dishesUnder250.map(item => ({
            id: item.id,
            name: item.name,
            price: getFinalPrice(item),
            originalPrice: item.originalPrice || item.price,
            image: item.image || item.images?.[0] || "",
            isVeg: item.foodType === 'Veg',
            bestPrice: item.discountAmount > 0 || (item.originalPrice && item.originalPrice > getFinalPrice(item)),
            description: item.description || "",
            category: item.category || item.sectionName || ""
          }))
        });
      }
    }

    // Sort by rating (highest first) or by number of dishes
    restaurantsWithDishes.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.menuItems.length - a.menuItems.length;
    });
    return successResponse(res, 200, 'Restaurants with dishes under ₹250 retrieved successfully', {
      restaurants: restaurantsWithDishes,
      total: restaurantsWithDishes.length
    });
  } catch (error) {
    console.error('Error fetching restaurants with dishes under ₹250:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurants with dishes under ₹250');
  }
};
