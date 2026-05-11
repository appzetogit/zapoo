import { useMemo, useEffect } from 'react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { calculateDistance } from '@/modules/DeliveryV2/hooks/proximity.utils';

/**
 * useProximityCheck - Professional hook for dynamic range monitoring.
 * Ensures rider can only advance based on Admin-defined ranges.
 * 
 * @returns {Object} { distanceToTarget, isWithinRange, actionLimit }
 */
export const useProximityCheck = () => {
  const riderLocation = useDeliveryStore((state) => state.riderLocation);
  const activeOrder = useDeliveryStore((state) => state.activeOrder);
  const tripStatus = useDeliveryStore((state) => state.tripStatus);
  const settings = useDeliveryStore((state) => state.settings);

  const normalizeLocation = (loc) => {
    if (!loc) return null;
    if (loc?.location?.coordinates?.length >= 2) {
      return { lat: Number(loc.location.coordinates[1]), lng: Number(loc.location.coordinates[0]) };
    }
    if (loc?.coordinates?.length >= 2) {
      return { lat: Number(loc.coordinates[1]), lng: Number(loc.coordinates[0]) };
    }
    const lat = Number(loc.lat ?? loc.latitude);
    const lng = Number(loc.lng ?? loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  };
  const firstValidLocation = (...candidates) => {
    for (const candidate of candidates) {
      const normalized = normalizeLocation(candidate);
      if (normalized) return normalized;
    }
    return null;
  };

  const parseRangeLimit = (value, fallback = 500) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  // Determine current target based on trip state
  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;
    
    // If heading to pickup or arrived at pickup, target is restaurant
    if (['PICKING_UP', 'REACHED_PICKUP'].includes(tripStatus)) {
      return firstValidLocation(
        activeOrder.restaurantLocation,
        activeOrder.restaurant_location,
        activeOrder.restaurantId,
        activeOrder.restaurant,
        activeOrder.deliveryState?.routeToPickup?.destination,
        activeOrder.deliveryState?.routeToPickup?.endLocation
      );
    }
    
    // If heading to drop or arrived at drop, target is customer
    if (['PICKED_UP', 'REACHED_DROP'].includes(tripStatus)) {
      return firstValidLocation(
        activeOrder.customerLocation,
        activeOrder.customer_location,
        activeOrder.deliveryAddress,
        activeOrder.address,
        activeOrder.userAddress,
        activeOrder.user?.location,
        activeOrder.deliveryState?.routeToCustomer?.destination,
        activeOrder.deliveryState?.routeToDelivery?.destination,
        activeOrder.deliveryState?.routeToCustomer?.endLocation,
        activeOrder.deliveryState?.routeToDelivery?.endLocation
      );
    }
    
    return null;
  }, [activeOrder, tripStatus]);

  // Determine current range limit from admin settings
  const actionLimit = useMemo(() => {
    if (tripStatus === 'PICKING_UP') return parseRangeLimit(settings.pickupRangeLimit, 500);
    if (tripStatus === 'PICKED_UP') return parseRangeLimit(settings.deliveryRangeLimit, 500);
    return 500;
  }, [tripStatus, settings]);

  // Calculate real-time distance
  const distanceToTarget = useMemo(() => {
    const rider = normalizeLocation(riderLocation);
    if (!rider || !targetLocation) return Infinity;
    
    return calculateDistance(
      rider.lat,
      rider.lng,
      targetLocation.lat,
      targetLocation.lng
    );
  }, [riderLocation, targetLocation]);

  // Fallback route distance (km -> meters) when live GPS/target resolution is temporarily unavailable.
  const fallbackDistanceMeters = useMemo(() => {
    if (!activeOrder) return Infinity;
    if (['PICKING_UP', 'REACHED_PICKUP'].includes(tripStatus)) {
      const pickupKm = Number(activeOrder?.deliveryState?.routeToPickup?.distance);
      if (Number.isFinite(pickupKm) && pickupKm >= 0) return pickupKm * 1000;
    }
    if (['PICKED_UP', 'REACHED_DROP'].includes(tripStatus)) {
      const dropKm =
        Number(activeOrder?.deliveryState?.routeToCustomer?.distance) ||
        Number(activeOrder?.deliveryState?.routeToDelivery?.distance);
      if (Number.isFinite(dropKm) && dropKm >= 0) return dropKm * 1000;
    }
    return Infinity;
  }, [activeOrder, tripStatus]);

  const effectiveDistanceToTarget = Number.isFinite(distanceToTarget)
    ? distanceToTarget
    : fallbackDistanceMeters;

  // Dev mode bypass
  const isDevMode = import.meta.env.VITE_APP_MODE === 'developer' || 
                    import.meta.env.VITE_ENABLE_RANGE_BYPASS === 'true' ||
                    import.meta.env.DEV;

  const isWithinRange = isDevMode ? true : (effectiveDistanceToTarget <= actionLimit);

  useEffect(() => {
    if (!activeOrder) return;
    console.log('🧭 [CoordDebug][Proximity][Snapshot]', {
      orderId: activeOrder?.orderId || activeOrder?._id,
      tripStatus,
      riderLocationRaw: riderLocation || null,
      targetLocationResolved: targetLocation || null,
      restaurantResolved: firstValidLocation(
        activeOrder?.restaurantLocation,
        activeOrder?.restaurant_location,
        activeOrder?.restaurantId,
        activeOrder?.restaurant
      ),
      customerResolved: firstValidLocation(
        activeOrder?.customerLocation,
        activeOrder?.customer_location,
        activeOrder?.deliveryAddress,
        activeOrder?.address,
        activeOrder?.userAddress,
        activeOrder?.user?.location
      ),
      distanceToTarget,
      effectiveDistanceToTarget,
      actionLimit,
      isWithinRange
    });
  }, [activeOrder, tripStatus, riderLocation, targetLocation, distanceToTarget, effectiveDistanceToTarget, actionLimit, isWithinRange]);

  return {
    distanceToTarget: effectiveDistanceToTarget,
    isWithinRange,
    actionLimit,
  };
};
