/**
 * Shared availability rules for user Home / Search (aligned with RestaurantStatus.jsx timing logic).
 */

const INDIA_TIME_ZONE = "Asia/Kolkata";
const DAY_ABBR = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== "string") return null;
  const normalized = timeValue.trim().toUpperCase();

  const amPmMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const meridiem = amPmMatch[3];
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (hours === 12) hours = 0;
    if (meridiem === "PM") hours += 12;
    return hours * 60 + minutes;
  }

  const twentyFourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourMatch) {
    const hours = Number(twentyFourMatch[1]);
    const minutes = Number(twentyFourMatch[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
};

const getCurrentIndiaDayAndMinutes = (now = new Date()) => {
  const dayName = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: INDIA_TIME_ZONE,
  }).format(now);

  const time24 = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: INDIA_TIME_ZONE,
  }).format(now);

  const [hourPart, minutePart] = time24.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);

  return {
    dayName,
    minutesOfDay:
      (Number.isFinite(hours) ? hours : 0) * 60 +
      (Number.isFinite(minutes) ? minutes : 0),
  };
};

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
    // Have coords but no computed distance - do not treat as in-range for Featured
    return false;
  }
  return Number(distanceInKm) <= range;
}

/**
 * Same open/closed logic as backend outletVisibilityService:
 * weeklyTimings (+ outletTimingsActive) first, then fallback to legacy openDays + deliveryTimings.
 */
export function isOpenForDeliveryNow(
  { openDays, deliveryTimings, weeklyTimings, outletTimingsActive } = {},
  now = new Date()
) {
  const { dayName, minutesOfDay } = getCurrentIndiaDayAndMinutes(now);

  const weekly = Array.isArray(weeklyTimings) ? weeklyTimings : [];
  if (weekly.length > 0) {
    if (outletTimingsActive === false) return false;
    const todayTiming = weekly.find((entry) => entry?.day === dayName);
    if (!todayTiming) return false;
    if (todayTiming.isOpen !== true) return false;

    const openingMinutes = parseTimeToMinutes(todayTiming.openingTime);
    const closingMinutes = parseTimeToMinutes(todayTiming.closingTime);
    if (openingMinutes == null || closingMinutes == null) return false;

    if (openingMinutes === closingMinutes) return true;
    if (closingMinutes > openingMinutes) {
      return minutesOfDay >= openingMinutes && minutesOfDay < closingMinutes;
    }
    return minutesOfDay >= openingMinutes || minutesOfDay < closingMinutes;
  }

  const days = Array.isArray(openDays) ? openDays : [];
  if (days.length > 0) {
    const dayAbbr = DAY_ABBR[dayName];
    if (!dayAbbr || !days.includes(dayAbbr)) return false;
  }

  const openingMinutes = parseTimeToMinutes(deliveryTimings?.openingTime);
  const closingMinutes = parseTimeToMinutes(deliveryTimings?.closingTime);
  if (openingMinutes == null || closingMinutes == null) return true;

  if (openingMinutes === closingMinutes) return true;
  if (closingMinutes > openingMinutes) {
    return minutesOfDay >= openingMinutes && minutesOfDay < closingMinutes;
  }
  return minutesOfDay >= openingMinutes || minutesOfDay < closingMinutes;
}

/**
 * Featured / "deliverable now" predicate (strict).
 */
export function isRestaurantDeliverableNow(restaurant, { userHasLocation, now = new Date() } = {}) {
  if (!restaurant) return false;
  if (restaurant.isActive === false) return false;
  if (restaurant.isAcceptingOrders === false) return false;
  if (
    !isOpenForDeliveryNow(
      {
        openDays: restaurant.openDays,
        deliveryTimings: restaurant.deliveryTimings,
        weeklyTimings: restaurant.weeklyTimings,
        outletTimingsActive: restaurant.outletTimingsActive,
      },
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
 * One-line reason for Search grey cards (priority: inactive -> not accepting -> range -> hours).
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
      {
        openDays: restaurant.openDays,
        deliveryTimings: restaurant.deliveryTimings,
        weeklyTimings: restaurant.weeklyTimings,
        outletTimingsActive: restaurant.outletTimingsActive,
      },
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
