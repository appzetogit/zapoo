import mongoose from 'mongoose';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Zone from '../models/Zone.js';
import Tier from '../models/Tier.js';

/**
 * Admin diagnostics: why customer delivery may show FREE (₹0) for a restaurant.
 * GET /api/admin/restaurants/:id/delivery-diagnostics
 */
export const getRestaurantDeliveryDiagnostics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return errorResponse(res, 400, 'Restaurant id is required');
  }

  let restaurant = null;
  if (mongoose.Types.ObjectId.isValid(id) && String(id).length === 24) {
    restaurant = await Restaurant.findById(id).select('name restaurantId zoneId deliveryPricingConfig location').lean();
  }
  if (!restaurant) {
    restaurant = await Restaurant.findOne({
      $or: [{ restaurantId: id }, { slug: id }]
    }).select('name restaurantId zoneId deliveryPricingConfig location').lean();
  }
  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  const warnings = [];
  const checks = {
    hasValidRestaurantCoords: Boolean(
      restaurant.location?.coordinates?.length === 2 &&
      !(restaurant.location.coordinates[0] === 0 && restaurant.location.coordinates[1] === 0)
    )
  };

  if (!checks.hasValidRestaurantCoords) {
    warnings.push('Restaurant location coordinates missing or zero — distanceKm will be 0.');
  }

  if (!restaurant.zoneId) {
    warnings.push('No zoneId on restaurant — tier distance slabs unavailable; customer per-km pricing cannot match slabs.');
  }

  let zone = null;
  let tier = null;
  if (restaurant.zoneId) {
    zone = await Zone.findById(restaurant.zoneId).select('name tierId').lean();
    if (!zone) {
      warnings.push('zoneId set but zone document not found.');
    } else if (!zone.tierId) {
      warnings.push('Zone has no tierId — no admin/customer slab definitions from tier.');
    } else {
      tier = await Tier.findById(zone.tierId).select('name deliveryPricing').lean();
      const slabs = tier?.deliveryPricing?.distanceSlabs;
      if (!Array.isArray(slabs) || slabs.length === 0) {
        warnings.push('Tier has no distanceSlabs — slab matching fails; customer delivery fee stays ₹0 when pricing is enabled.');
      }
    }
  }

  const cfg = restaurant.deliveryPricingConfig || {};
  if (!cfg.isEnabled) {
    warnings.push('deliveryPricingConfig.isEnabled is false — customer delivery fee is forced to ₹0 by backend.');
  }
  if (!Array.isArray(cfg.orderValueSlabs) || cfg.orderValueSlabs.length === 0) {
    warnings.push('No orderValueSlabs configured — customer delivery fee cannot be resolved.');
  }
  if (!Array.isArray(cfg.customerDeliveryRates) || cfg.customerDeliveryRates.length === 0) {
    warnings.push('No customerDeliveryRates grid — customer delivery fee cannot be resolved for any slab pair.');
  }

  const activeSlabIds = new Set(
    (tier?.deliveryPricing?.distanceSlabs || [])
      .filter((s) => s && s.isActive !== false)
      .map((s) => String(s._id))
  );
  const orderSlabIds = new Set((cfg.orderValueSlabs || []).map((s) => String(s._id)).filter(Boolean));

  const orphanRates = (cfg.customerDeliveryRates || []).filter((r) => {
    const d = String(r.distanceSlabId || '');
    const o = String(r.orderValueSlabId || '');
    return !d || !activeSlabIds.has(d) || !o || !orderSlabIds.has(o);
  });
  if (orphanRates.length > 0) {
    warnings.push(
      `${orphanRates.length} customerDeliveryRates row(s) reference invalid distanceSlabId or orderValueSlabId (tier slabs or order slabs mismatch).`
    );
  }

  return successResponse(res, 200, 'Delivery pricing diagnostics', {
    restaurant: {
      _id: restaurant._id,
      name: restaurant.name,
      restaurantId: restaurant.restaurantId
    },
    zone: zone ? { _id: zone._id, name: zone.name, tierId: zone.tierId } : null,
    tier: tier
      ? {
          _id: tier._id,
          name: tier.name,
          distanceSlabCount: (tier.deliveryPricing?.distanceSlabs || []).length,
          activeDistanceSlabCount: activeSlabIds.size
        }
      : null,
    deliveryPricingConfig: {
      isEnabled: !!cfg.isEnabled,
      orderValueSlabCount: (cfg.orderValueSlabs || []).length,
      customerDeliveryRateCount: (cfg.customerDeliveryRates || []).length
    },
    checks,
    warnings,
    issueCount: warnings.length
  });
});
