import Zone from '../models/Zone.js';
import Tier from '../models/Tier.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';
import * as turf from '@turf/turf';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { resolveLocalizedText, toLocalizedText } from '../../../shared/i18n/localizedText.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';

function mergeLocalizedValue(existingValue, localizedOverride, fallback = '') {
  const merged = toLocalizedText(existingValue, fallback);
  if (localizedOverride && typeof localizedOverride === 'object') {
    for (const locale of ['en', 'hi', 'bn']) {
      if (typeof localizedOverride[locale] === 'string') {
        merged[locale] = localizedOverride[locale];
      }
    }
  }
  return merged;
}

async function enrichLocalizedValue(localizedValue, sourceLocale, autoTranslate, overrides = null) {
  if (sourceLocale === 'en' && autoTranslate && localizedValue.en) {
    try {
      const translated = await buildLocalizedText(localizedValue.en);
      if (!overrides?.hi) localizedValue.hi = translated.hi || localizedValue.hi;
      if (!overrides?.bn) localizedValue.bn = translated.bn || localizedValue.bn;
    } catch (error) {
      console.warn(`[i18n] Zone translation failed: ${error.message}`);
    }
  }
  return localizedValue;
}

function resolveZoneForLocale(zone, locale) {
  const resolvedName = resolveLocalizedText(zone.localizedName, locale, zone.name || zone.zoneName || '');
  const resolvedZoneName = resolveLocalizedText(zone.localizedZoneName, locale, zone.zoneName || zone.name || '');

  return {
    ...zone,
    name: resolvedName,
    zoneName: resolvedZoneName,
    displayName: resolvedZoneName
  };
}

function toLongitudeLatitude(coord) {
  if (!coord || typeof coord !== 'object') {
    throw new Error('Invalid zone coordinate format');
  }

  const latitude = Number(coord.latitude ?? coord.lat);
  const longitude = Number(coord.longitude ?? coord.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Each coordinate must contain numeric latitude and longitude');
  }

  return [longitude, latitude];
}

function closePolygonRingIfNeeded(ring) {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, first];
  }
  return ring;
}

function buildPolygonFromCoordinates(coordinates) {
  const ring = closePolygonRingIfNeeded(coordinates.map(toLongitudeLatitude));
  return turf.polygon([ring]);
}

function buildPolygonFromZone(zone) {
  if (
    zone?.boundary?.type === 'Polygon' &&
    Array.isArray(zone?.boundary?.coordinates) &&
    zone.boundary.coordinates.length > 0
  ) {
    return turf.polygon(zone.boundary.coordinates);
  }

  if (Array.isArray(zone?.coordinates) && zone.coordinates.length >= 3) {
    return buildPolygonFromCoordinates(zone.coordinates);
  }

  return null;
}

function hasInteriorOverlap(candidatePolygon, existingPolygon) {
  const intersection = turf.intersect(
    turf.featureCollection([candidatePolygon, existingPolygon])
  );

  if (!intersection) return false;
  return turf.area(intersection) > 0;
}

async function validateZoneGeometryConstraints({ coordinates, excludeZoneId = null }) {
  const candidatePolygon = buildPolygonFromCoordinates(coordinates);
  const candidateAreaSqKm = turf.area(candidatePolygon) / 1000000;

  const largestActiveTier = await Tier.findOne({ isActive: true })
    .sort({ maxArea: -1 })
    .select('name maxArea')
    .lean();

  if (!largestActiveTier) {
    return {
      isValid: false,
      message: 'No active tiers configured. Please activate at least one tier before creating zones.'
    };
  }

  const maxAllowedArea = Number(largestActiveTier.maxArea);
  if (candidateAreaSqKm > maxAllowedArea) {
    return {
      isValid: false,
      message: `Zone area exceeds maximum allowed area ${maxAllowedArea} km2 (largest active tier: ${largestActiveTier.name}). Computed area: ${candidateAreaSqKm.toFixed(2)} km2.`
    };
  }

  const zoneQuery = {};
  if (excludeZoneId && mongoose.Types.ObjectId.isValid(String(excludeZoneId))) {
    zoneQuery._id = { $ne: new mongoose.Types.ObjectId(excludeZoneId) };
  }

  const existingZones = await Zone.find(zoneQuery)
    .select('_id name zoneName coordinates boundary')
    .lean();

  for (const existingZone of existingZones) {
    const existingPolygon = buildPolygonFromZone(existingZone);
    if (!existingPolygon) continue;

    if (hasInteriorOverlap(candidatePolygon, existingPolygon)) {
      const existingZoneName = existingZone.zoneName || existingZone.name || String(existingZone._id);
      return {
        isValid: false,
        message: `Zone overlaps with existing zone: ${existingZoneName}`
      };
    }
  }

  return { isValid: true };
}

/**
 * Get all zones
 * GET /api/admin/zones
 */
export const getZones = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const {
      page = 1,
      limit = 50,
      search,
      restaurantId,
      isActive
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { zoneName: { $regex: search, $options: 'i' } },
        { 'localizedName.en': { $regex: search, $options: 'i' } },
        { 'localizedName.hi': { $regex: search, $options: 'i' } },
        { 'localizedName.bn': { $regex: search, $options: 'i' } },
        { 'localizedZoneName.en': { $regex: search, $options: 'i' } },
        { 'localizedZoneName.hi': { $regex: search, $options: 'i' } },
        { 'localizedZoneName.bn': { $regex: search, $options: 'i' } },
        { serviceLocation: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } }
      ];
    }

    if (restaurantId) {
      query.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch zones with restaurant details (if restaurantId exists)
    const zones = await Zone.find(query)
      .populate({
        path: 'restaurantId',
        select: 'name email phone',
        match: { _id: { $exists: true } }
      })
      .populate('createdBy', 'name email')
      .populate('tierId', 'name rank')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Zone.countDocuments(query);

    return successResponse(res, 200, 'Zones retrieved successfully', {
      zones: zones.map((zone) => resolveZoneForLocale(zone, locale)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching zones:', error);
    return errorResponse(res, 500, 'Failed to fetch zones');
  }
});

/**
 * Get zone by ID
 * GET /api/admin/zones/:id
 */
export const getZoneById = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const { id } = req.params;

    const zone = await Zone.findById(id)
      .populate({
        path: 'restaurantId',
        select: 'name email phone',
        match: { _id: { $exists: true } }
      })
      .populate('createdBy', 'name email')
      .lean();

    if (!zone) {
      return errorResponse(res, 404, 'Zone not found');
    }

    return successResponse(res, 200, 'Zone retrieved successfully', {
      zone: resolveZoneForLocale(zone, locale)
    });
  } catch (error) {
    console.error('Error fetching zone:', error);
    return errorResponse(res, 500, 'Failed to fetch zone');
  }
});

/**
 * Create new zone
 * POST /api/admin/zones
 */
export const createZone = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const {
      name,
      zoneName,
      displayName,
      localizedName,
      localizedZoneName,
      locale: sourceLocaleInput,
      autoTranslate = true,
      country,
      serviceLocation,
      restaurantId,
      unit,
      coordinates,
      isActive,
      deliveryPricing
    } = req.body;

    // Validation - For customer zones, country and zoneName are required instead of restaurantId
    if (!name && !zoneName) {
      return errorResponse(res, 400, 'Zone name is required');
    }
    if (!country) {
      return errorResponse(res, 400, 'Country is required');
    }
    if (!coordinates) {
      return errorResponse(res, 400, 'Coordinates are required');
    }

    if (!Array.isArray(coordinates) || coordinates.length < 3) {
      return errorResponse(res, 400, 'Zone must have at least 3 coordinates');
    }

    // Validate coordinates
    for (const coord of coordinates) {
      if (!coord.latitude || !coord.longitude) {
        return errorResponse(res, 400, 'Each coordinate must have latitude and longitude');
      }
      if (coord.latitude < -90 || coord.latitude > 90) {
        return errorResponse(res, 400, 'Invalid latitude value');
      }
      if (coord.longitude < -180 || coord.longitude > 180) {
        return errorResponse(res, 400, 'Invalid longitude value');
      }
    }

    const zoneGeometryValidation = await validateZoneGeometryConstraints({ coordinates });
    if (!zoneGeometryValidation.isValid) {
      return errorResponse(res, 400, zoneGeometryValidation.message);
    }

    // Check if restaurant exists (only if restaurantId is provided)
    if (restaurantId) {
      const Restaurant = mongoose.model('Restaurant');
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return errorResponse(res, 404, 'Restaurant not found');
      }
    }

    // Create zone
    const sourceLocale = normalizeLocale(sourceLocaleInput || 'en');
    const canonicalName = name || zoneName || displayName || '';
    const canonicalZoneName = zoneName || displayName || name || '';

    let nextLocalizedName = mergeLocalizedValue(localizedName, localizedName, canonicalName);
    let nextLocalizedZoneName = mergeLocalizedValue(localizedZoneName, localizedZoneName, canonicalZoneName);
    nextLocalizedName[sourceLocale] = canonicalName || nextLocalizedName[sourceLocale];
    nextLocalizedZoneName[sourceLocale] = canonicalZoneName || nextLocalizedZoneName[sourceLocale];
    if (!nextLocalizedName.en) nextLocalizedName.en = canonicalName;
    if (!nextLocalizedZoneName.en) nextLocalizedZoneName.en = canonicalZoneName;
    nextLocalizedName = await enrichLocalizedValue(nextLocalizedName, sourceLocale, autoTranslate, localizedName);
    nextLocalizedZoneName = await enrichLocalizedValue(nextLocalizedZoneName, sourceLocale, autoTranslate, localizedZoneName);

    const zoneData = {
      name: nextLocalizedName.en || canonicalName,
      localizedName: nextLocalizedName,
      zoneName: nextLocalizedZoneName.en || canonicalZoneName,
      localizedZoneName: nextLocalizedZoneName,
      country: country || 'India',
      serviceLocation: serviceLocation || country,
      restaurantId: restaurantId ? new mongoose.Types.ObjectId(restaurantId) : null,
      unit: unit || 'kilometer',
      coordinates,
      isActive: isActive !== undefined ? isActive : true,
      deliveryPricing,
      createdBy: req.admin?._id || null
    };

    const zone = new Zone(zoneData);
    await zone.save();

    // Populate before returning (only if restaurantId exists)
    if (zone.restaurantId) {
      await zone.populate('restaurantId', 'name email phone');
    }
    if (zone.createdBy) {
      await zone.populate('createdBy', 'name email');
    }
    await zone.populate('tierId', 'name rank minArea maxArea');

    return successResponse(res, 201, 'Zone created successfully', {
      zone: resolveZoneForLocale(zone.toObject(), locale)
    });
  } catch (error) {
    console.error('Error creating zone:', error);
    if (error.name === 'ValidationError') {
      return errorResponse(res, 400, error.message);
    }
    return errorResponse(res, 500, 'Failed to create zone');
  }
});

/**
 * Update zone
 * PUT /api/admin/zones/:id
 */
export const updateZone = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const { id } = req.params;
    const updateData = { ...req.body };
    const sourceLocale = normalizeLocale(updateData.locale || 'en');
    const autoTranslate = updateData.autoTranslate !== undefined ? Boolean(updateData.autoTranslate) : true;

    const zone = await Zone.findById(id);
    if (!zone) {
      return errorResponse(res, 404, 'Zone not found');
    }

    // If coordinates are being updated, validate them
    if (updateData.coordinates) {
      if (!Array.isArray(updateData.coordinates) || updateData.coordinates.length < 3) {
        return errorResponse(res, 400, 'Zone must have at least 3 coordinates');
      }

      // Validate coordinates
      for (const coord of updateData.coordinates) {
        if (!coord.latitude || !coord.longitude) {
          return errorResponse(res, 400, 'Each coordinate must have latitude and longitude');
        }
      }

      const zoneGeometryValidation = await validateZoneGeometryConstraints({
        coordinates: updateData.coordinates,
        excludeZoneId: id
      });
      if (!zoneGeometryValidation.isValid) {
        return errorResponse(res, 400, zoneGeometryValidation.message);
      }
    }

    const coordinatesChanged = !!updateData.coordinates;

    if (typeof updateData.displayName === 'string' && updateData.displayName.trim()) {
      updateData.zoneName = updateData.displayName.trim();
    }

    const hasNameInput = typeof updateData.name === 'string';
    const hasZoneNameInput = typeof updateData.zoneName === 'string';
    const incomingLocalizedName = updateData.localizedName;
    const incomingLocalizedZoneName = updateData.localizedZoneName;

    if (hasNameInput || incomingLocalizedName) {
      let nextLocalizedName = mergeLocalizedValue(
        zone.localizedName,
        incomingLocalizedName,
        zone.name || zone.zoneName || ''
      );
      if (hasNameInput) nextLocalizedName[sourceLocale] = updateData.name;
      if (!nextLocalizedName.en) nextLocalizedName.en = zone.name || zone.zoneName || updateData.name || '';
      nextLocalizedName = await enrichLocalizedValue(
        nextLocalizedName,
        sourceLocale,
        autoTranslate,
        incomingLocalizedName
      );
      updateData.localizedName = nextLocalizedName;
      updateData.name = nextLocalizedName.en;
    }

    if (hasZoneNameInput || incomingLocalizedZoneName) {
      let nextLocalizedZoneName = mergeLocalizedValue(
        zone.localizedZoneName,
        incomingLocalizedZoneName,
        zone.zoneName || zone.name || ''
      );
      if (hasZoneNameInput) nextLocalizedZoneName[sourceLocale] = updateData.zoneName;
      if (!nextLocalizedZoneName.en) {
        nextLocalizedZoneName.en = zone.zoneName || zone.name || updateData.zoneName || '';
      }
      nextLocalizedZoneName = await enrichLocalizedValue(
        nextLocalizedZoneName,
        sourceLocale,
        autoTranslate,
        incomingLocalizedZoneName
      );
      updateData.localizedZoneName = nextLocalizedZoneName;
      updateData.zoneName = nextLocalizedZoneName.en;
    }

    delete updateData.displayName;
    delete updateData.locale;
    delete updateData.autoTranslate;

    // Update zone
    Object.assign(zone, updateData);

    // Mongoose often does not mark document-array coordinates as modified after Object.assign,
    // so the new polygon may not persist and pre-save area/tier logic may not run.
    if (coordinatesChanged) {
      zone.markModified('coordinates');
    }

    await zone.save();

    // Re-validate restaurant assignments when polygon changes
    if (coordinatesChanged) {
      const restaurantsInZone = await Restaurant.find({ zoneId: zone._id })
        .select('_id location')
        .lean();

      if (restaurantsInZone.length > 0) {
        const activeZones = await Zone.find({ isActive: true });
        const bulkOps = [];

        for (const r of restaurantsInZone) {
          const lat = r.location?.latitude;
          const lng = r.location?.longitude;
          if (!lat || !lng) continue;

          if (!zone.containsPoint(lat, lng)) {
            let newZoneId = null;
            for (const z of activeZones) {
              if (z._id.toString() === zone._id.toString()) continue;
              if (z.containsPoint && z.containsPoint(lat, lng)) {
                newZoneId = z._id;
                break;
              }
            }
            bulkOps.push({
              updateOne: {
                filter: { _id: r._id },
                update: { $set: { zoneId: newZoneId } }
              }
            });
          }
        }

        if (bulkOps.length > 0) {
          await Restaurant.bulkWrite(bulkOps);
        }
      }
    }

    // Populate before returning (only if restaurantId exists)
    if (zone.restaurantId) {
      await zone.populate('restaurantId', 'name email phone');
    }
    if (zone.createdBy) {
      await zone.populate('createdBy', 'name email');
    }
    await zone.populate('tierId', 'name rank minArea maxArea');

    return successResponse(res, 200, 'Zone updated successfully', {
      zone: resolveZoneForLocale(zone.toObject(), locale)
    });
  } catch (error) {
    console.error('Error updating zone:', error);
    if (error.name === 'ValidationError') {
      return errorResponse(res, 400, error.message);
    }
    return errorResponse(res, 500, 'Failed to update zone');
  }
});

/**
 * Delete zone
 * DELETE /api/admin/zones/:id
 */
export const deleteZone = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findByIdAndDelete(id);
    if (!zone) {
      return errorResponse(res, 404, 'Zone not found');
    }

    return successResponse(res, 200, 'Zone deleted successfully');
  } catch (error) {
    console.error('Error deleting zone:', error);
    return errorResponse(res, 500, 'Failed to delete zone');
  }
});

/**
 * Toggle zone status
 * PATCH /api/admin/zones/:id/status
 */
export const toggleZoneStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);
    if (!zone) {
      return errorResponse(res, 404, 'Zone not found');
    }

    zone.isActive = !zone.isActive;
    await zone.save();

    return successResponse(res, 200, `Zone ${zone.isActive ? 'activated' : 'deactivated'} successfully`, {
      zone
    });
  } catch (error) {
    console.error('Error toggling zone status:', error);
    return errorResponse(res, 500, 'Failed to toggle zone status');
  }
});

/**
 * Get zones by restaurant ID
 * GET /api/admin/zones/restaurant/:restaurantId
 */
export const getZonesByRestaurant = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const { restaurantId } = req.params;

    const zones = await Zone.find({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      isActive: true
    })
      .populate({
        path: 'restaurantId',
        select: 'name email phone',
        match: { _id: { $exists: true } }
      })
      .sort({ createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Zones retrieved successfully', {
      zones: zones.map((zone) => resolveZoneForLocale(zone, locale))
    });
  } catch (error) {
    console.error('Error fetching zones by restaurant:', error);
    return errorResponse(res, 500, 'Failed to fetch zones');
  }
});

/**
 * Detect user's zone based on location (PUBLIC API for user module)
 * GET /api/zones/detect?lat=&lng=
 */
export const detectUserZone = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const { lat, lng, latitude, longitude } = req.query;

    // Support both lat/lng and latitude/longitude
    const userLat = parseFloat(lat || latitude);
    const userLng = parseFloat(lng || longitude);

    if (!userLat || !userLng || isNaN(userLat) || isNaN(userLng)) {
      return errorResponse(res, 400, 'Latitude and longitude are required');
    }

    if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
      return errorResponse(res, 400, 'Invalid coordinates');
    }

    // Get all active zones
    const activeZones = await Zone.find({ isActive: true }).lean();

    if (activeZones.length === 0) {
      return successResponse(res, 200, 'No active zones found', {
        status: 'OUT_OF_SERVICE',
        zoneId: null,
        zone: null,
        message: 'No delivery zones are currently active'
      });
    }

    // Check which zone the user belongs to
    let userZone = null;
    let minDistance = Infinity;

    for (const zone of activeZones) {
      if (!zone.coordinates || zone.coordinates.length < 3) continue;

      let isInZone = false;
      if (typeof zone.containsPoint === 'function') {
        isInZone = zone.containsPoint(userLat, userLng);
      } else {
        // Ray casting algorithm
        let inside = false;
        for (let i = 0, j = zone.coordinates.length - 1; i < zone.coordinates.length; j = i++) {
          const coordI = zone.coordinates[i];
          const coordJ = zone.coordinates[j];
          const xi = typeof coordI === 'object' ? (coordI.latitude || coordI.lat) : null;
          const yi = typeof coordI === 'object' ? (coordI.longitude || coordI.lng) : null;
          const xj = typeof coordJ === 'object' ? (coordJ.latitude || coordJ.lat) : null;
          const yj = typeof coordJ === 'object' ? (coordJ.longitude || coordJ.lng) : null;

          if (xi === null || yi === null || xj === null || yj === null) continue;

          const intersect = ((yi > userLng) !== (yj > userLng)) &&
            (userLat < (xj - xi) * (userLng - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        isInZone = inside;
      }

      if (isInZone) {
        // Calculate distance to zone centroid for buffer logic
        const centroid = calculateZoneCentroid(zone.coordinates);
        const distance = calculateDistance(userLat, userLng, centroid.lat, centroid.lng);

        if (distance < minDistance) {
          minDistance = distance;
          userZone = zone;
        }
      }
    }

    // If user is not in any zone, check buffer area (50-100 meters)
    if (!userZone) {
      const BUFFER_DISTANCE = 0.1; // 100 meters in km

      for (const zone of activeZones) {
        if (!zone.coordinates || zone.coordinates.length < 3) continue;

        const centroid = calculateZoneCentroid(zone.coordinates);
        const distance = calculateDistance(userLat, userLng, centroid.lat, centroid.lng);

        // Find nearest zone within buffer
        if (distance <= BUFFER_DISTANCE && distance < minDistance) {
          minDistance = distance;
          userZone = zone;
        }
      }
    }

    if (!userZone) {
      return successResponse(res, 200, 'User location is outside all service zones', {
        status: 'OUT_OF_SERVICE',
        zoneId: null,
        zone: null,
        message: 'Your location is not within any active delivery zone. Please check if delivery is available in your area.'
      });
    }

    return successResponse(res, 200, 'Zone detected successfully', {
      status: 'IN_SERVICE',
      zoneId: userZone._id.toString(),
      zone: {
        _id: userZone._id.toString(),
        name: resolveLocalizedText(userZone.localizedName, locale, userZone.name || userZone.zoneName),
        zoneName: resolveLocalizedText(userZone.localizedZoneName, locale, userZone.zoneName || userZone.name),
        country: userZone.country,
        unit: userZone.unit
      },
      message: 'Service available in your area'
    });
  } catch (error) {
    console.error('Error detecting user zone:', error);
    return errorResponse(res, 500, 'Failed to detect zone');
  }
});

/**
 * Get all active zones (PUBLIC API)
 * GET /api/zones/active
 */
export const getActiveZonesPublic = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const zones = await Zone.find({ isActive: true })
      .select('name zoneName localizedName localizedZoneName country coordinates isActive')
      .lean();

    return successResponse(res, 200, 'Active zones retrieved successfully', {
      zones: zones.map((zone) => ({
        ...zone,
        name: resolveLocalizedText(zone.localizedName, locale, zone.name || zone.zoneName),
        zoneName: resolveLocalizedText(zone.localizedZoneName, locale, zone.zoneName || zone.name)
      }))
    });
  } catch (error) {
    console.error('Error fetching active zones (public):', error);
    return errorResponse(res, 500, 'Failed to fetch active zones');
  }
});

/**
 * Calculate zone centroid (average of all coordinates)
 */
function calculateZoneCentroid(coordinates) {
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  for (const coord of coordinates) {
    const lat = typeof coord === 'object' ? (coord.latitude || coord.lat) : null;
    const lng = typeof coord === 'object' ? (coord.longitude || coord.lng) : null;
    if (lat !== null && lng !== null) {
      sumLat += lat;
      sumLng += lng;
      count++;
    }
  }

  return {
    lat: count > 0 ? sumLat / count : 0,
    lng: count > 0 ? sumLng / count : 0
  };
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a location is within any zone for a restaurant
 * POST /api/admin/zones/check-location
 */
export const checkLocationInZone = asyncHandler(async (req, res) => {
  try {
    const locale = resolveLocaleFromRequest(req);
    const { latitude, longitude, restaurantId } = req.body;

    if (!latitude || !longitude || !restaurantId) {
      return errorResponse(res, 400, 'Latitude, longitude, and restaurant ID are required');
    }

    // Find zones for the restaurant
    const zones = await Zone.find({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      isActive: true
    });

    // Check if point is within any zone using GeoJSON
    const point = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    const matchingZones = zones.filter(zone => {
      if (!zone.boundary || !zone.boundary.coordinates) {
        return false;
      }
      // Use MongoDB's $geoWithin for accurate spatial query
      // For now, use the method we defined
      return zone.containsPoint(parseFloat(latitude), parseFloat(longitude));
    });

    return successResponse(res, 200, 'Location check completed', {
      isInZone: matchingZones.length > 0,
      zones: matchingZones.map(zone => ({
        _id: zone._id,
        name: resolveLocalizedText(zone.localizedName, locale, zone.name || zone.zoneName),
        zoneName: resolveLocalizedText(zone.localizedZoneName, locale, zone.zoneName || zone.name),
        country: zone.country,
        serviceLocation: zone.serviceLocation
      }))
    });
  } catch (error) {
    console.error('Error checking location in zone:', error);
    return errorResponse(res, 500, 'Failed to check location');
  }
});
