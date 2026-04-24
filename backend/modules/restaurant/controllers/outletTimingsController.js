import Restaurant from '../models/Restaurant.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_TO_ABBR = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun'
};

const sanitizeTime = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const createDefaultWeeklyTimings = (restaurant) => {
  const openDays = Array.isArray(restaurant?.openDays) ? restaurant.openDays : [];
  const hasOpenDays = openDays.length > 0;
  const openingTime = sanitizeTime(restaurant?.deliveryTimings?.openingTime, '09:00 AM');
  const closingTime = sanitizeTime(restaurant?.deliveryTimings?.closingTime, '10:00 PM');

  return DAY_ORDER.map((day) => ({
    day,
    isOpen: hasOpenDays ? openDays.includes(DAY_TO_ABBR[day]) : true,
    openingTime,
    closingTime
  }));
};

const normalizeWeeklyTimings = (rawTimings, restaurant) => {
  const fallback = createDefaultWeeklyTimings(restaurant);
  const existingByDay = new Map(
    (Array.isArray(rawTimings) ? rawTimings : [])
      .filter((entry) => entry?.day && DAY_ORDER.includes(entry.day))
      .map((entry) => [entry.day, entry])
  );

  return DAY_ORDER.map((day) => {
    const current = existingByDay.get(day);
    const fb = fallback.find((item) => item.day === day);
    return {
      day,
      isOpen: typeof current?.isOpen === 'boolean' ? current.isOpen : fb.isOpen,
      openingTime: sanitizeTime(current?.openingTime, fb.openingTime),
      closingTime: sanitizeTime(current?.closingTime, fb.closingTime)
    };
  });
};

const syncOpenDaysAbbr = (weeklyTimings = []) =>
  weeklyTimings
    .filter((entry) => entry?.isOpen === true && DAY_TO_ABBR[entry.day])
    .map((entry) => DAY_TO_ABBR[entry.day]);

const buildResponseShape = (restaurantId, weeklyTimings, isActive) => ({
  restaurantId,
  outletType: 'Appzeto delivery',
  timings: weeklyTimings,
  isActive: isActive !== false
});

async function ensureRestaurantWeeklyTimings(restaurantDoc) {
  const normalized = normalizeWeeklyTimings(restaurantDoc.weeklyTimings, restaurantDoc);
  const nextOpenDays = syncOpenDaysAbbr(normalized);
  const changed =
    JSON.stringify(normalized) !== JSON.stringify(restaurantDoc.weeklyTimings || []) ||
    JSON.stringify(nextOpenDays) !== JSON.stringify(restaurantDoc.openDays || []) ||
    restaurantDoc.outletTimingsActive === undefined;

  if (changed) {
    restaurantDoc.weeklyTimings = normalized;
    if (typeof restaurantDoc.outletTimingsActive !== 'boolean') {
      restaurantDoc.outletTimingsActive = true;
    }
    restaurantDoc.openDays = nextOpenDays;
    if (!restaurantDoc.onboarding) restaurantDoc.onboarding = {};
    if (!restaurantDoc.onboarding.step2) restaurantDoc.onboarding.step2 = {};
    restaurantDoc.onboarding.step2.openDays = nextOpenDays;
    await restaurantDoc.save();
  }

  return normalized;
}

/**
 * Get outlet timings for the authenticated restaurant
 * @route GET /api/restaurant/outlet-timings
 */
export const getOutletTimings = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurant._id);
  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  const weekly = await ensureRestaurantWeeklyTimings(restaurant);

  return successResponse(res, 200, 'Outlet timings retrieved successfully', {
    outletTimings: buildResponseShape(
      restaurant._id,
      weekly,
      restaurant.outletTimingsActive
    )
  });
});

/**
 * Get outlet timings by restaurant ID (public route)
 * @route GET /api/restaurant/:restaurantId/outlet-timings
 */
export const getOutletTimingsByRestaurantId = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant || !restaurant.isActive) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  const weekly = await ensureRestaurantWeeklyTimings(restaurant);

  return successResponse(res, 200, 'Outlet timings retrieved successfully', {
    outletTimings: buildResponseShape(
      restaurant._id,
      weekly,
      restaurant.outletTimingsActive
    )
  });
});

/**
 * Create or update outlet timings for the authenticated restaurant
 * @route PUT /api/restaurant/outlet-timings
 */
export const upsertOutletTimings = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurant._id);
  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  const timings = req.body?.timings;
  if (timings && !Array.isArray(timings)) {
    return errorResponse(res, 400, 'Timings must be an array');
  }
  if (timings && timings.length !== 7) {
    return errorResponse(res, 400, 'All 7 days must be provided');
  }

  if (timings) {
    const presentDays = timings.map((item) => item.day);
    const allDaysPresent = DAY_ORDER.every((day) => presentDays.includes(day));
    if (!allDaysPresent) {
      return errorResponse(res, 400, 'All 7 days (Monday-Sunday) must be present');
    }

    for (const timing of timings) {
      if (!DAY_ORDER.includes(timing.day)) {
        return errorResponse(res, 400, `Invalid day: ${timing.day}`);
      }
      if (timing.isOpen && (!timing.openingTime || !timing.closingTime)) {
        return errorResponse(
          res,
          400,
          `Opening and closing times are required for ${timing.day} when open`
        );
      }
    }
  }

  const normalized = normalizeWeeklyTimings(timings || restaurant.weeklyTimings, restaurant);
  const nextOpenDays = syncOpenDaysAbbr(normalized);
  restaurant.weeklyTimings = normalized;
  restaurant.outletTimingsActive =
    typeof restaurant.outletTimingsActive === 'boolean' ? restaurant.outletTimingsActive : true;
  restaurant.openDays = nextOpenDays;
  restaurant.onboarding = restaurant.onboarding || {};
  restaurant.onboarding.step2 = restaurant.onboarding.step2 || {};
  restaurant.onboarding.step2.openDays = nextOpenDays;
  await restaurant.save();

  return successResponse(res, 200, 'Outlet timings updated successfully', {
    outletTimings: buildResponseShape(
      restaurant._id,
      restaurant.weeklyTimings,
      restaurant.outletTimingsActive
    )
  });
});

/**
 * Update a specific day's timing
 * @route PATCH /api/restaurant/outlet-timings/day/:day
 */
export const updateDayTiming = asyncHandler(async (req, res) => {
  const { day } = req.params;
  const { isOpen, openingTime, closingTime } = req.body;

  if (!DAY_ORDER.includes(day)) {
    return errorResponse(
      res,
      400,
      'Invalid day. Must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday'
    );
  }

  const restaurant = await Restaurant.findById(req.restaurant._id);
  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  const normalized = normalizeWeeklyTimings(restaurant.weeklyTimings, restaurant);
  const dayIndex = normalized.findIndex((item) => item.day === day);
  if (dayIndex === -1) {
    return errorResponse(res, 404, `Timing for ${day} not found`);
  }

  if (isOpen !== undefined) normalized[dayIndex].isOpen = Boolean(isOpen);
  if (openingTime !== undefined) {
    normalized[dayIndex].openingTime = sanitizeTime(openingTime, normalized[dayIndex].openingTime);
  }
  if (closingTime !== undefined) {
    normalized[dayIndex].closingTime = sanitizeTime(closingTime, normalized[dayIndex].closingTime);
  }

  if (normalized[dayIndex].isOpen) {
    if (!normalized[dayIndex].openingTime || !normalized[dayIndex].closingTime) {
      return errorResponse(res, 400, 'Opening and closing times are required when day is open');
    }
  }

  const nextOpenDays = syncOpenDaysAbbr(normalized);
  restaurant.weeklyTimings = normalized;
  restaurant.openDays = nextOpenDays;
  restaurant.onboarding = restaurant.onboarding || {};
  restaurant.onboarding.step2 = restaurant.onboarding.step2 || {};
  restaurant.onboarding.step2.openDays = nextOpenDays;
  restaurant.outletTimingsActive =
    typeof restaurant.outletTimingsActive === 'boolean' ? restaurant.outletTimingsActive : true;
  await restaurant.save();

  return successResponse(res, 200, `${day} timing updated successfully`, {
    outletTimings: buildResponseShape(
      restaurant._id,
      restaurant.weeklyTimings,
      restaurant.outletTimingsActive
    )
  });
});

/**
 * Toggle outlet timings active status
 * @route PATCH /api/restaurant/outlet-timings/status
 */
export const toggleOutletTimingsStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const restaurant = await Restaurant.findById(req.restaurant._id);
  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  restaurant.outletTimingsActive =
    isActive !== undefined
      ? Boolean(isActive)
      : !(typeof restaurant.outletTimingsActive === 'boolean'
        ? restaurant.outletTimingsActive
        : true);
  await restaurant.save();

  const weekly = normalizeWeeklyTimings(restaurant.weeklyTimings, restaurant);
  return successResponse(
    res,
    200,
    `Outlet timings ${restaurant.outletTimingsActive ? 'activated' : 'deactivated'} successfully`,
    {
      outletTimings: buildResponseShape(
        restaurant._id,
        weekly,
        restaurant.outletTimingsActive
      )
    }
  );
});

/**
 * Delete outlet timings (soft delete by setting isActive to false)
 * @route DELETE /api/restaurant/outlet-timings
 */
export const deleteOutletTimings = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurant._id);
  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  restaurant.outletTimingsActive = false;
  await restaurant.save();

  return successResponse(res, 200, 'Outlet timings deleted successfully');
});

