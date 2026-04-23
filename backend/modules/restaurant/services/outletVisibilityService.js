import OutletTimings from '../models/OutletTimings.js';

const INDIA_TIME_ZONE = 'Asia/Kolkata';

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== 'string') return null;
  const normalized = timeValue.trim().toUpperCase();
  const amPmMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const meridiem = amPmMatch[3];
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (hours === 12) hours = 0;
    if (meridiem === 'PM') hours += 12;
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
  const dayName = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: INDIA_TIME_ZONE
  }).format(now);

  const time24 = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: INDIA_TIME_ZONE
  }).format(now);

  const [hourPart, minutePart] = time24.split(':');
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  return {
    dayName,
    minutesOfDay: (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0)
  };
};

const isRestaurantOpenNowFromOutletTiming = (timingDoc, currentDay, currentMinutes) => {
  // Backward compatible default: if no doc, do not hide.
  if (!timingDoc) return true;
  if (timingDoc.isActive === false) return false;

  const todayTiming = (timingDoc.timings || []).find((entry) => entry?.day === currentDay);
  if (!todayTiming) return false;
  if (todayTiming.isOpen !== true) return false;

  const openingMinutes = parseTimeToMinutes(todayTiming.openingTime);
  const closingMinutes = parseTimeToMinutes(todayTiming.closingTime);
  if (openingMinutes == null || closingMinutes == null) return false;

  if (openingMinutes === closingMinutes) return true;
  if (closingMinutes > openingMinutes) {
    return currentMinutes >= openingMinutes && currentMinutes < closingMinutes;
  }
  return currentMinutes >= openingMinutes || currentMinutes < closingMinutes;
};

export const filterRestaurantsByOutletTimings = async (restaurants = []) => {
  if (!Array.isArray(restaurants) || restaurants.length === 0) return restaurants;

  const restaurantIds = restaurants.map((restaurant) => restaurant?._id).filter(Boolean);
  if (restaurantIds.length === 0) return restaurants;

  const timingDocs = await OutletTimings.find({
    restaurantId: { $in: restaurantIds }
  }).select('restaurantId timings isActive').lean();

  const timingByRestaurantId = new Map(
    timingDocs.map((doc) => [String(doc.restaurantId), doc])
  );

  const { dayName, minutesOfDay } = getCurrentIndiaDayAndMinutes();
  return restaurants.filter((restaurant) =>
    isRestaurantOpenNowFromOutletTiming(
      timingByRestaurantId.get(String(restaurant._id)),
      dayName,
      minutesOfDay
    )
  );
};

