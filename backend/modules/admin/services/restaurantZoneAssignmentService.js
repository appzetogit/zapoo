import mongoose from 'mongoose';
import Zone from '../models/Zone.js';
import Restaurant from '../../restaurant/models/Restaurant.js';

/**
 * Normalize lat/lng from restaurant location objects (GeoJSON + flat fields).
 * @param {object|null|undefined} location
 * @returns {{ lat: number, lng: number } | null}
 */
export function extractLatLngFromLocation(location) {
  if (!location || typeof location !== 'object') return null;

  let lat = location.latitude;
  let lng = location.longitude;

  if (
    (lat === undefined || lat === null || lng === undefined || lng === null) &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length >= 2
  ) {
    lng = Number(location.coordinates[0]);
    lat = Number(location.coordinates[1]);
  } else {
    lat = lat != null ? Number(lat) : NaN;
    lng = lng != null ? Number(lng) : NaN;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

/**
 * Find active zone whose GeoJSON boundary contains the point.
 */
export async function findActiveZoneContainingPoint(lat, lng) {
  return Zone.findOne({
    isActive: true,
    boundary: {
      $geoIntersects: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      },
    },
  })
    .select('_id tierId name')
    .lean();
}

/**
 * Resolve zone + tier for a location payload (tier is denormalized from zone).
 */
export async function resolveZoneAndTierForLocation(location) {
  const coords = extractLatLngFromLocation(location);
  if (!coords) {
    return { zoneId: null, tierId: null };
  }

  const zone = await findActiveZoneContainingPoint(coords.lat, coords.lng);
  if (!zone) {
    return { zoneId: null, tierId: null };
  }

  return {
    zoneId: zone._id,
    tierId: zone.tierId || null,
  };
}

/** User-facing message when a restaurant pin is outside all active zones (API + thrown errors). */
export const RESTAURANT_LOCATION_OUTSIDE_ZONE_MESSAGE =
  'This location is not inside any active service zone. Please choose a location within a covered area or contact support.';

/**
 * Self-serve flows: if location includes a valid pin, it must fall inside an active zone.
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function assertRestaurantPinInsideActiveZone(location) {
  const coords = extractLatLngFromLocation(location);
  if (!coords) {
    return { ok: true };
  }
  const zone = await findActiveZoneContainingPoint(coords.lat, coords.lng);
  if (!zone) {
    return { ok: false, message: RESTAURANT_LOCATION_OUTSIDE_ZONE_MESSAGE };
  }
  return { ok: true };
}

/**
 * Persist zoneId + tierId on a restaurant from its current DB location.
 * Call after any flow that updates restaurant.location.
 */
export async function applyZoneTierToRestaurantById(restaurantId) {
  if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
    return { zoneId: null, tierId: null };
  }

  const doc = await Restaurant.findById(restaurantId).select('location').lean();
  if (!doc?.location) {
    await Restaurant.findByIdAndUpdate(restaurantId, {
      $set: { zoneId: null, tierId: null },
    });
    return { zoneId: null, tierId: null };
  }

  const { zoneId, tierId } = await resolveZoneAndTierForLocation(doc.location);

  await Restaurant.findByIdAndUpdate(restaurantId, {
    $set: {
      zoneId: zoneId || null,
      tierId: tierId || null,
    },
  });

  return { zoneId, tierId };
}
