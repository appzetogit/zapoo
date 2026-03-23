/**
 * Shared availability rules for user Home / Search (aligned with RestaurantStatus.jsx timing logic).
 */

/**
 * @param {number|null|undefined} distanceInKm
 * @param {number|null|undefined} deliveryRangeKm
 * @param {{ userHasLocation: boolean }} opts
 */
export function isWithinDeliveryRangeKm(distanceInKm, deliveryRangeKm, opts) {
  const { userHasLocation } = opts || {};
  if (!userHasLocation) return true;
  const range =
    deliveryRangeKm != null && Number.isFinite(Number(deliveryRangeKm))
      ? Number(deliveryRangeKm)
      : 5;
  if (distanceInKm == null || !Number.isFinite(Number(distanceInKm))) {
    // Have coords but no computed distance — do not treat as in-range for Featured
    return false;
  }
  return Number(distanceInKm) <= range;
}

/**
 * Same day / overnight close logic as RestaurantStatus (API fields only).
 * Missing deliveryTimings → open. Empty openDays → treat as open (lenient for listings).
 */
export function isOpenForDeliveryNow({ openDays, deliveryTimings } = {}, now = new Date()) {
  const currentDay = now.toLocaleDateString("en-US", { weekday: "short" });

  const days = openDays;
  if (Array.isArray(days) && days.length > 0) {
    const isDayOpen = days.some((day) => {
      const dayAbbr = String(day).substring(0, 3);
      return dayAbbr === currentDay;
    });
    if (!isDayOpen) return false;
  }

  const dt = deliveryTimings;
  if (!dt || !dt.openingTime || !dt.closingTime) {
    return true;
  }

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const [openHour, openMinute] = String(dt.openingTime).split(":").map(Number);
  const [closeHour, closeMinute] = String(dt.closingTime).split(":").map(Number);
  if (
    !Number.isFinite(openHour) ||
    !Number.isFinite(openMinute) ||
    !Number.isFinite(closeHour) ||
    !Number.isFinite(closeMinute)
  ) {
    return true;
  }

  const openingTimeInMinutes = openHour * 60 + openMinute;
  const closingTimeInMinutes = closeHour * 60 + closeMinute;

  if (closingTimeInMinutes > openingTimeInMinutes) {
    return currentTimeInMinutes >= openingTimeInMinutes && currentTimeInMinutes <= closingTimeInMinutes;
  }
  return currentTimeInMinutes >= openingTimeInMinutes || currentTimeInMinutes <= closingTimeInMinutes;
}

/**
 * Featured / “deliverable now” predicate (strict).
 */
export function isRestaurantDeliverableNow(restaurant, { userHasLocation, now = new Date() } = {}) {
  if (!restaurant) return false;
  if (restaurant.isActive === false) return false;
  if (restaurant.isAcceptingOrders === false) return false;
  if (
    !isOpenForDeliveryNow(
      { openDays: restaurant.openDays, deliveryTimings: restaurant.deliveryTimings },
      now
    )
  ) {
    return false;
  }
  const rangeKm =
    restaurant.deliveryRange != null && Number.isFinite(Number(restaurant.deliveryRange))
      ? Number(restaurant.deliveryRange)
      : restaurant.deliveryRangeKm != null && Number.isFinite(Number(restaurant.deliveryRangeKm))
        ? Number(restaurant.deliveryRangeKm)
        : 5;
  return isWithinDeliveryRangeKm(restaurant.distanceInKm, rangeKm, { userHasLocation });
}

/**
 * One-line reason for Search grey cards (priority: inactive → not accepting → range → hours).
 */
export function getSearchUnavailableLabel(
  restaurant,
  { distanceInKm, userHasLocation, now = new Date() } = {}
) {
  if (!restaurant) return "Unavailable";

  if (restaurant.isActive === false) {
    return "Inactive on platform";
  }
  if (restaurant.isAcceptingOrders === false) {
    return "Not accepting orders";
  }

  const rangeKm =
    restaurant.deliveryRange != null && Number.isFinite(Number(restaurant.deliveryRange))
      ? Number(restaurant.deliveryRange)
      : restaurant.deliveryRangeKm != null && Number.isFinite(Number(restaurant.deliveryRangeKm))
        ? Number(restaurant.deliveryRangeKm)
        : 5;

  if (userHasLocation && distanceInKm != null && Number.isFinite(Number(distanceInKm))) {
    if (Number(distanceInKm) > rangeKm) {
      return "Outside delivery area";
    }
  }

  if (
    !isOpenForDeliveryNow(
      { openDays: restaurant.openDays, deliveryTimings: restaurant.deliveryTimings },
      now
    )
  ) {
    const open = restaurant.deliveryTimings?.openingTime;
    if (open && String(open).trim()) {
      return `Closed · Opens at ${String(open).trim()}`;
    }
    return "Closed for delivery";
  }

  return "Unavailable";
}
