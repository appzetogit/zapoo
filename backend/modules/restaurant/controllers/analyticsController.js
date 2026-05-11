import mongoose from "mongoose";
import Order from "../../order/models/Order.js";
import asyncHandler from "../../../shared/middleware/asyncHandler.js";
import { successResponse, errorResponse } from "../../../shared/utils/response.js";

const PERIODS = new Set(["daily", "weekly", "monthly", "yearly"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const formatPercent = (value, total) => {
  if (!total) return "- 0%";
  return `${((value / total) * 100).toFixed(1)}%`;
};

const getRestaurantIdVariations = (restaurant) => {
  const restaurantId = restaurant?._id?.toString() || restaurant?.restaurantId || restaurant?.id;
  const variations = [restaurantId, restaurant?._id?.toString(), restaurant?.restaurantId, restaurant?.id].filter(Boolean);

  if (restaurantId && mongoose.Types.ObjectId.isValid(restaurantId)) {
    variations.push(new mongoose.Types.ObjectId(restaurantId).toString());
  }

  return [...new Set(variations)];
};

const getRangeForPeriod = (period) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "weekly") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(now.getDate() + mondayOffset);
    end.setDate(start.getDate() + 6);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
  } else if (period === "yearly") {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getBucketSeed = (period, start, end) => {
  if (period === "daily") {
    return [
      { hour: "12am", orders: 0, sales: 0, _key: "12am_0" },
      { hour: "4am", orders: 0, sales: 0, _key: "4am" },
      { hour: "8am", orders: 0, sales: 0, _key: "8am" },
      { hour: "12pm", orders: 0, sales: 0, _key: "12pm" },
      { hour: "4pm", orders: 0, sales: 0, _key: "4pm" },
      { hour: "8pm", orders: 0, sales: 0, _key: "8pm" },
      { hour: "12am", orders: 0, sales: 0, _key: "12am_1" },
    ];
  }

  if (period === "weekly") {
    const points = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      points.push({
        day: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        fullLabel: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        orders: 0,
        sales: 0,
        _key: cursor.toISOString().slice(0, 10),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }

  if (period === "monthly") {
    const points = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      points.push({
        date: cursor.getDate().toString(),
        fullLabel: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        orders: 0,
        sales: 0,
        _key: cursor.toISOString().slice(0, 10),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }

  const points = [];
  const cursor = new Date(start.getFullYear(), 0, 1);
  for (let month = 0; month < 12; month += 1) {
    const d = new Date(cursor.getFullYear(), month, 1);
    points.push({
      month: d.toLocaleDateString("en-US", { month: "short" }),
      fullLabel: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      orders: 0,
      sales: 0,
      _key: `${d.getFullYear()}-${String(month + 1).padStart(2, "0")}`,
    });
  }
  return points;
};

const getBucketKeyFromDate = (period, date) => {
  if (period === "daily") {
    const hour = date.getHours();
    if (hour < 4) return "12am_0";
    if (hour < 8) return "4am";
    if (hour < 12) return "8am";
    if (hour < 16) return "12pm";
    if (hour < 20) return "4pm";
    return "8pm";
  }

  if (period === "yearly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  return date.toISOString().slice(0, 10);
};

const buildMealtimeMetrics = (orders) => {
  const getMinutesInIndiaTime = (dateInput) => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  };

  const buckets = {
    breakfast: { count: 0, color: "#111827" },
    lunch: { count: 0, color: "#ef4444" },
    eveningSnacks: { count: 0, color: "#2563eb" },
    dinner: { count: 0, color: "#f59e0b" },
    lateNight: { count: 0, color: "#10b981" },
  };

  orders.forEach((order) => {
    const minutes = getMinutesInIndiaTime(order.createdAt);
    if (minutes == null) return;
    if (minutes >= 420 && minutes < 660) buckets.breakfast.count += 1;
    else if (minutes >= 660 && minutes < 960) buckets.lunch.count += 1;
    else if (minutes >= 960 && minutes < 1140) buckets.eveningSnacks.count += 1;
    else if (minutes >= 1140 && minutes < 1380) buckets.dinner.count += 1;
    else buckets.lateNight.count += 1;
  });

  const total = orders.length;
  return [
    {
      title: "Breakfast",
      window: "7:00 am - 11:00 am",
      value: String(buckets.breakfast.count),
      change: formatPercent(buckets.breakfast.count, total),
      color: buckets.breakfast.color,
    },
    {
      title: "Lunch",
      window: "11:00 am - 4:00 pm",
      value: String(buckets.lunch.count),
      change: formatPercent(buckets.lunch.count, total),
      color: buckets.lunch.color,
    },
    {
      title: "Evening snacks",
      window: "4:00 pm - 7:00 pm",
      value: String(buckets.eveningSnacks.count),
      change: formatPercent(buckets.eveningSnacks.count, total),
      color: buckets.eveningSnacks.color,
    },
    {
      title: "Dinner",
      window: "7:00 pm - 11:00 pm",
      value: String(buckets.dinner.count),
      change: formatPercent(buckets.dinner.count, total),
      color: buckets.dinner.color,
    },
    {
      title: "Late night",
      window: "11:00 pm - 7:00 am",
      value: String(buckets.lateNight.count),
      change: formatPercent(buckets.lateNight.count, total),
      color: buckets.lateNight.color,
    },
  ];
};

const buildOffersMetrics = (orders, totalOrders) => {
  const safeTotalOrders = Number(totalOrders) || 0;
  const offerOrders = orders.filter((order) => {
    const discount = Number(order?.pricing?.discount || 0);
    const couponCode = String(order?.pricing?.couponCode || "").trim();
    return discount > 0 || couponCode.length > 0;
  });

  const offerRedemptions = offerOrders.length;
  const grossSalesFromOffers = offerOrders.reduce(
    (sum, order) => sum + Number(order?.pricing?.subtotal || 0),
    0
  );
  const totalDiscountGiven = offerOrders.reduce(
    (sum, order) => sum + Number(order?.pricing?.discount || 0),
    0
  );

  const effectiveDiscountRate =
    grossSalesFromOffers > 0 ? (totalDiscountGiven / grossSalesFromOffers) * 100 : 0;
  const ordersFromOffersRate =
    safeTotalOrders > 0 ? (offerRedemptions / safeTotalOrders) * 100 : 0;
  const costPerRedemption =
    offerRedemptions > 0 ? totalDiscountGiven / offerRedemptions : 0;

  return {
    // Click tracking is not yet persisted in current order/analytics flow.
    offerClicks: null,
    offerRedemptions,
    conversionRatePct: null,
    costPerRedemption,
    grossSalesFromOffers,
    totalDiscountGiven,
    ordersFromOffers: offerRedemptions,
    effectiveDiscountRate,
    ordersFromOffersRate,
  };
};

export const getRestaurantAnalytics = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const period = PERIODS.has(String(req.query.period || "").toLowerCase())
      ? String(req.query.period).toLowerCase()
      : "daily";

    let range = getRangeForPeriod(period);
    if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      const end = new Date(req.query.endDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        range = { start, end };
      }
    }

    const restaurantIds = getRestaurantIdVariations(restaurant);
    if (!restaurantIds.length) {
      return errorResponse(res, 500, "Restaurant ID not found");
    }

    const [filteredOrders, ordersTillEnd] = await Promise.all([
      Order.find({
        restaurantId: { $in: restaurantIds },
        status: "delivered",
        createdAt: { $gte: range.start, $lte: range.end },
      })
        .select("userId createdAt pricing")
        .lean(),
      Order.find({
        restaurantId: { $in: restaurantIds },
        status: "delivered",
        createdAt: { $lte: range.end },
      })
        .select("userId createdAt")
        .lean(),
    ]);

    const seed = getBucketSeed(period, range.start, range.end);
    const bucketMap = new Map(seed.map((b) => [b._key, b]));

    let totalSales = 0;
    filteredOrders.forEach((order) => {
      const d = new Date(order.createdAt);
      const key = getBucketKeyFromDate(period, d);
      const bucket = bucketMap.get(key);
      const amount = Number(order?.pricing?.total || 0);
      if (bucket) {
        bucket.orders += 1;
        bucket.sales += amount;
      }
      totalSales += amount;
    });

    const chartData = seed.map(({ _key, ...rest }) => ({
      ...rest,
      sales: Math.round(rest.sales),
    }));
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders ? totalSales / totalOrders : 0;
    const offers = buildOffersMetrics(filteredOrders, totalOrders);

    const ordersByUser = new Map();
    ordersTillEnd.forEach((order) => {
      const userKey = order?.userId ? String(order.userId) : null;
      if (!userKey) return;
      if (!ordersByUser.has(userKey)) ordersByUser.set(userKey, []);
      ordersByUser.get(userKey).push(new Date(order.createdAt));
    });
    ordersByUser.forEach((dates) => dates.sort((a, b) => a - b));

    const activeUsers = [...new Set(filteredOrders.map((o) => (o.userId ? String(o.userId) : null)).filter(Boolean))];

    let newCustomers = 0;
    let repeatCustomers = 0;
    let lapsedCustomers = 0;

    activeUsers.forEach((userId) => {
      const dates = ordersByUser.get(userId) || [];
      if (!dates.length) return;
      const firstOrderDate = dates[0];
      if (firstOrderDate >= range.start && firstOrderDate <= range.end) {
        newCustomers += 1;
        return;
      }

      const previousOrders = dates.filter((d) => d < range.start);
      const latestBeforeRange = previousOrders.length ? previousOrders[previousOrders.length - 1] : null;
      if (!latestBeforeRange) {
        newCustomers += 1;
        return;
      }

      const daysGap = Math.floor((range.start - latestBeforeRange) / DAY_MS);
      if (daysGap <= 60) repeatCustomers += 1;
      else lapsedCustomers += 1;
    });

    const totalCustomersInRange = activeUsers.length;
    const customers = [
      {
        title: "New customers",
        sub: "First order in selected period",
        value: String(newCustomers),
        change: formatPercent(newCustomers, totalCustomersInRange),
        color: "#111827",
      },
      {
        title: "Repeat customers",
        sub: "Ordered in last 60 days",
        value: String(repeatCustomers),
        change: formatPercent(repeatCustomers, totalCustomersInRange),
        color: "#ef4444",
      },
      {
        title: "Lapsed customers",
        sub: "Last order 60+ days ago",
        value: String(lapsedCustomers),
        change: formatPercent(lapsedCustomers, totalCustomersInRange),
        color: "#2563eb",
      },
    ];

    return successResponse(res, 200, "Restaurant analytics retrieved successfully", {
      period,
      startDate: range.start,
      endDate: range.end,
      summary: {
        totalSales: Math.round(totalSales),
        totalOrders,
        averageOrderValue: Math.round(averageOrderValue),
      },
      chartData,
      mealtime: buildMealtimeMetrics(filteredOrders),
      customers,
      offers,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error("Error fetching restaurant analytics:", error);
    return errorResponse(res, 500, "Failed to fetch restaurant analytics");
  }
});
