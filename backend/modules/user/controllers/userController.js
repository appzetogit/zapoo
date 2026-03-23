import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import User from '../../auth/models/User.js';
import { getRedisClient } from '../../../config/redis.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';
import axios from 'axios';
import winston from 'winston';
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

/**
 * Update user's currentLocation from saved address (single save with addresses[]).
 * Ensures DB reflects delivery pin even if PUT /user/location fails on the client.
 */
function setUserCurrentLocationFromAddressCoords(user, fields) {
  const {
    street,
    city,
    state,
    zipCode,
    additionalDetails,
    latitude,
    longitude
  } = fields;
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    return;
  }
  if (latitude === '' || longitude === '') {
    return;
  }
  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return;
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return;

  const s = street != null ? String(street) : '';
  const c = city != null ? String(city) : '';
  const st = state != null ? String(state) : '';
  const formattedParts = [additionalDetails, s, c, st, zipCode].filter(
    x => x != null && String(x).trim() !== ''
  );
  const formattedAddress = formattedParts.map(x => String(x).trim()).join(', ');

  user.currentLocation = {
    latitude: latNum,
    longitude: lngNum,
    address: `${s}, ${c}`.replace(/^,\s*/, '').replace(/,\s*$/, '').trim() || formattedAddress,
    city: c,
    state: st,
    formattedAddress: formattedAddress || `${s}, ${c}, ${st}`.replace(/^,\s*|,\s*$/g, '').trim(),
    lastUpdated: new Date(),
    location: {
      type: 'Point',
      coordinates: [lngNum, latNum]
    }
  };
  if (zipCode != null && String(zipCode).trim() !== '') {
    user.currentLocation.postalCode = String(zipCode).trim();
  }
}

/**
 * Get user profile
 * GET /api/user/profile
 */
export const getUserProfile = asyncHandler(async (req, res) => {
  try {
    // Exclude large arrays like addresses and fcmTokens, as they have separate endpoints if needed
    const user = await User.findById(req.user._id)
      .select('-password -addresses -fcmTokens -paymentMethods -favorites')
      .lean();
    if (!user) {
      return errorResponse(res, 404, 'User profile not found');
    }
    return successResponse(res, 200, 'User profile retrieved successfully', {
      user
    });
  } catch (error) {
    logger.error(`Error fetching user profile: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch user profile');
  }
});

/**
 * Update user profile
 * PUT /api/user/profile
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      dateOfBirth,
      anniversary,
      gender
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User profile not found');
    }

    // Update fields
    if (name !== undefined && name !== null) {
      user.name = name.trim();
    }
    if (email !== undefined && email !== null && email.trim() !== '') {
      // Check if email already exists for another user
      const existingUser = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: user._id },
        role: 'user'
      }).select('_id').lean();
      if (existingUser) {
        return errorResponse(res, 400, 'Email already in use');
      }
      user.email = email.toLowerCase().trim();
    }
    if (phone !== undefined && phone !== null) {
      // Check if phone already exists for another user
      if (phone.trim() !== '') {
        const existingUser = await User.findOne({
          phone: phone.trim(),
          _id: { $ne: user._id },
          role: 'user'
        }).select('_id').lean();
        if (existingUser) {
          return errorResponse(res, 400, 'Phone number already in use');
        }
      }
      user.phone = phone ? phone.trim() : null;
    }

    // Update additional profile fields (if they exist in schema)
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth || null;
    }
    if (anniversary !== undefined) {
      user.anniversary = anniversary || null;
    }
    if (gender !== undefined) {
      user.gender = gender || null;
    }

    // Save to database
    await user.save();

    // Invalidate Redis cache
    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.del(`user_session:${user._id}`).catch(e => logger.warn(`[Redis] Cache invalidation failed: ${e.message}`));
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    return successResponse(res, 200, 'Profile updated successfully', {
      user: userResponse
    });
  } catch (error) {
    logger.error(`Error updating user profile: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to update profile');
  }
});

/**
 * Upload profile image
 * POST /api/user/profile/avatar
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/user-profiles';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [{
        width: 400,
        height: 400,
        crop: 'fill',
        gravity: 'face'
      }, {
        quality: 'auto'
      }]
    });

    // Update user profile image
    user.profileImage = result.secure_url;
    await user.save();

    // Invalidate Redis cache
    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.del(`user_session:${user._id}`).catch(e => logger.warn(`[Redis] Cache invalidation failed for user ${user._id}: ${e.message}`));
    }
    return successResponse(res, 200, 'Profile image uploaded successfully', {
      profileImage: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    logger.error(`Error uploading profile image: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to upload profile image');
  }
});

/**
 * Update user current location (Live Location Tracking)
 * PUT /api/user/location
 * 
 * This endpoint handles both regular location updates and live location tracking.
 * It stores complete address information including POI, building, floor, area, city, state, pincode.
 */
export const updateUserLocation = asyncHandler(async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      address,
      city,
      state,
      formattedAddress,
      accuracy,
      postalCode,
      street,
      streetNumber,
      /** When true, bypass 5s throttle (manual address save / saved-address pick) */
      skipLocationThrottle
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return errorResponse(res, 400, 'Latitude and longitude are required');
    }
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    // Validate coordinates
    if (isNaN(latNum) || isNaN(lngNum)) {
      return errorResponse(res, 400, 'Invalid latitude or longitude');
    }

    // Validate coordinate ranges
    if (latNum < -90 || latNum > 90) {
      return errorResponse(res, 400, 'Latitude must be between -90 and 90');
    }
    if (lngNum < -180 || lngNum > 180) {
      return errorResponse(res, 400, 'Longitude must be between -180 and 180');
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Throttle only rapid duplicate coordinates (live GPS spam). Moving the pin / new address
    // must always persist even if lastUpdated was <5s ago (continuous watch updates lastUpdated).
    const bypassThrottle =
      skipLocationThrottle === true || skipLocationThrottle === 'true';
    const lastUpdate = user.currentLocation?.lastUpdated;
    const prevLat = user.currentLocation?.latitude;
    const prevLng = user.currentLocation?.longitude;
    const within5s =
      lastUpdate && new Date() - new Date(lastUpdate) < 5000;
    const COORD_EPS = 0.00025; // ~25m latitude; good enough to treat as "same spot"
    const sameAsStored =
      prevLat != null &&
      prevLng != null &&
      !Number.isNaN(Number(prevLat)) &&
      !Number.isNaN(Number(prevLng)) &&
      Math.abs(latNum - Number(prevLat)) < COORD_EPS &&
      Math.abs(lngNum - Number(prevLng)) < COORD_EPS;

    if (!bypassThrottle && within5s && sameAsStored) {
      return successResponse(res, 200, 'Location update throttled', {
        location: user.currentLocation,
        message: 'Rate limit: duplicate location skipped'
      });
    }

    // Build complete location object with all available data
    const locationUpdate = {
      latitude: latNum,
      longitude: lngNum,
      address: address || user.currentLocation?.address || '',
      city: city || user.currentLocation?.city || '',
      state: state || user.currentLocation?.state || '',
      formattedAddress: formattedAddress || user.currentLocation?.formattedAddress || '',
      lastUpdated: new Date(),
      location: {
        type: 'Point',
        coordinates: [lngNum, latNum] // [longitude, latitude] for GeoJSON
      }
    };

    // Add optional fields if provided
    if (accuracy !== undefined && accuracy !== null) {
      locationUpdate.accuracy = parseFloat(accuracy);
    }
    if (postalCode) {
      locationUpdate.postalCode = postalCode;
    }
    if (street) {
      locationUpdate.street = street;
    }
    if (streetNumber) {
      locationUpdate.streetNumber = streetNumber;
    }

    // Update current location
    user.currentLocation = locationUpdate;

    // Save to database
    await user.save();

    // Invalidate Redis cache
    const redisClient = getRedisClient();
    if (redisClient) {
      await redisClient.del(`user_session:${user._id}`).catch(e => logger.warn(`[Redis] Cache invalidation failed: ${e.message}`));
    }
    const userResponse = user.toObject();
    delete userResponse.password;
    return successResponse(res, 200, 'Location updated successfully', {
      location: user.currentLocation,
      message: 'Live location stored in database'
    });
  } catch (error) {
    logger.error(`Error updating user location: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to update location');
  }
});

/**
 * Get user current location
 * GET /api/user/location
 */
export const getUserLocation = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('currentLocation').lean();
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    return successResponse(res, 200, 'Location retrieved successfully', {
      location: user.currentLocation || null
    });
  } catch (error) {
    logger.error(`Error fetching user location: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch location');
  }
});

/**
 * Get user addresses
 * GET /api/user/addresses
 */
export const getUserAddresses = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses').lean();
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Add _id to each address for frontend compatibility
    const addresses = (user.addresses || []).map(addr => ({
      ...addr,
      id: addr._id ? addr._id.toString() : null
    }));
    return successResponse(res, 200, 'Addresses retrieved successfully', {
      addresses
    });
  } catch (error) {
    logger.error(`Error fetching user addresses: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch addresses');
  }
});

/**
 * Add user address
 * POST /api/user/addresses
 */
export const addUserAddress = asyncHandler(async (req, res) => {
  try {
    const {
      label,
      street,
      additionalDetails,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      isDefault
    } = req.body;
    if (!street || !city || !state) {
      return errorResponse(res, 400, 'Street, city, and state are required');
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Prepare address object
    const newAddress = {
      label: label || 'Other',
      street,
      additionalDetails: additionalDetails || '',
      city,
      state,
      zipCode: zipCode || '',
      isDefault: isDefault === true || (user.addresses || []).length === 0
    };

    let latNum;
    let lngNum;
    if (latitude != null && longitude != null && latitude !== '' && longitude !== '') {
      const pLat = parseFloat(latitude);
      const pLng = parseFloat(longitude);
      if (!Number.isNaN(pLat) && !Number.isNaN(pLng)) {
        latNum = pLat;
        lngNum = pLng;
        newAddress.location = {
          type: 'Point',
          coordinates: [lngNum, latNum] // [longitude, latitude]
        };
      }
    }

    // If this is set as default, unset other defaults
    if (newAddress.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Add address
    user.addresses.push(newAddress);

    if (latNum != null && lngNum != null && !Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
      setUserCurrentLocationFromAddressCoords(user, {
        street,
        city,
        state,
        zipCode,
        additionalDetails,
        latitude: latNum,
        longitude: lngNum
      });
    }

    await user.save();

    const redisAfterAddress = getRedisClient();
    if (redisAfterAddress) {
      await redisAfterAddress.del(`user_session:${user._id}`).catch(e => logger.warn(`[Redis] ${e.message}`));
    }

    // Get the added address with _id
    const addedAddress = user.addresses[user.addresses.length - 1];
    const addressResponse = {
      ...addedAddress.toObject(),
      id: addedAddress._id.toString()
    };
    return successResponse(res, 201, 'Address added successfully', {
      address: addressResponse
    });
  } catch (error) {
    logger.error(`Error adding address: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to add address');
  }
});

/**
 * Update user address
 * PUT /api/user/addresses/:id
 */
export const updateUserAddress = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      label,
      street,
      additionalDetails,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      isDefault
    } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    const address = user.addresses.id(id);
    if (!address) {
      return errorResponse(res, 404, 'Address not found');
    }

    // Update address fields
    if (label !== undefined) address.label = label;
    if (street !== undefined) address.street = street;
    if (additionalDetails !== undefined) address.additionalDetails = additionalDetails;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (zipCode !== undefined) address.zipCode = zipCode;

    // Update location coordinates if provided
    if (latitude !== undefined && longitude !== undefined) {
      const latNum = parseFloat(latitude);
      const lngNum = parseFloat(longitude);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        address.location = {
          type: 'Point',
          coordinates: [lngNum, latNum] // [longitude, latitude]
        };
      }
    }

    // Handle default address
    if (isDefault === true) {
      user.addresses.forEach(addr => {
        addr.isDefault = addr._id.toString() === id;
      });
    } else if (isDefault === false && address.isDefault) {
      // If unsetting default and this was the default, set first other address as default
      const otherAddress = user.addresses.find(addr => addr._id.toString() !== id);
      if (otherAddress) {
        otherAddress.isDefault = true;
      }
      address.isDefault = false;
    }

    let syncLat = latitude;
    let syncLng = longitude;
    if (
      (syncLat === undefined || syncLng === undefined) &&
      address.location?.coordinates?.length === 2
    ) {
      syncLng = address.location.coordinates[0];
      syncLat = address.location.coordinates[1];
    }
    setUserCurrentLocationFromAddressCoords(user, {
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      additionalDetails: address.additionalDetails,
      latitude: syncLat,
      longitude: syncLng
    });

    await user.save();

    const redisAfterAddressUpdate = getRedisClient();
    if (redisAfterAddressUpdate) {
      await redisAfterAddressUpdate.del(`user_session:${user._id}`).catch(e => logger.warn(`[Redis] ${e.message}`));
    }

    const addressResponse = {
      ...address.toObject(),
      id: address._id.toString()
    };
    return successResponse(res, 200, 'Address updated successfully', {
      address: addressResponse
    });
  } catch (error) {
    logger.error(`Error updating address: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to update address');
  }
});

/**
 * Delete user address
 * DELETE /api/user/addresses/:id
 */
export const deleteUserAddress = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    const address = user.addresses.id(id);
    if (!address) {
      return errorResponse(res, 404, 'Address not found');
    }
    const wasDefault = address.isDefault;

    // Remove address
    user.addresses.pull(id);

    // If deleted address was default, set first remaining address as default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    return successResponse(res, 200, 'Address deleted successfully');
  } catch (error) {
    logger.error(`Error deleting address: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to delete address');
  }
});