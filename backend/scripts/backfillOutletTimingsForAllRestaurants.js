import dotenv from "dotenv";
import mongoose from "mongoose";
import Restaurant from "../modules/restaurant/models/Restaurant.js";

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
if (!uri) {
  console.error("Missing MongoDB URI. Set MONGODB_URI in backend/.env");
  process.exit(1);
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_TO_ABBR = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

function normalizeTime(value, fallback) {
  if (typeof value !== "string") return fallback;
  const t = value.trim();
  return t || fallback;
}

function buildFallbackWeekly(restaurant) {
  const opening = normalizeTime(restaurant?.deliveryTimings?.openingTime, "09:00 AM");
  const closing = normalizeTime(restaurant?.deliveryTimings?.closingTime, "10:00 PM");
  const openDays = Array.isArray(restaurant?.openDays) ? restaurant.openDays : [];
  const hasOpenDays = openDays.length > 0;

  return DAYS.map((day) => ({
    day,
    isOpen: hasOpenDays ? openDays.includes(DAY_TO_ABBR[day]) : true,
    openingTime: opening,
    closingTime: closing,
  }));
}

function normalizeWeeklyTimings(sourceTimings, fallbackWeekly) {
  const sourceByDay = new Map();
  for (const entry of Array.isArray(sourceTimings) ? sourceTimings : []) {
    if (entry?.day && DAYS.includes(entry.day)) {
      sourceByDay.set(entry.day, entry);
    }
  }

  return DAYS.map((day) => {
    const source = sourceByDay.get(day);
    const fallback = fallbackWeekly.find((d) => d.day === day);
    return {
      day,
      isOpen: typeof source?.isOpen === "boolean" ? source.isOpen : fallback.isOpen,
      openingTime: normalizeTime(source?.openingTime, fallback.openingTime),
      closingTime: normalizeTime(source?.closingTime, fallback.closingTime),
    };
  });
}

function openDaysFromWeekly(weekly = []) {
  return weekly
    .filter((entry) => entry?.isOpen === true && DAY_TO_ABBR[entry.day])
    .map((entry) => DAY_TO_ABBR[entry.day]);
}

async function getLegacyOutletTimingsMap(connection) {
  const collections = await connection.db.listCollections({}, { nameOnly: true }).toArray();
  const collectionName = collections.some((c) => c.name === "outlettimings")
    ? "outlettimings"
    : null;
  if (!collectionName) return { map: new Map(), exists: false };

  const docs = await connection.db
    .collection(collectionName)
    .find({}, { projection: { restaurantId: 1, timings: 1, isActive: 1 } })
    .toArray();

  const map = new Map(
    docs
      .filter((doc) => doc?.restaurantId)
      .map((doc) => [String(doc.restaurantId), doc]),
  );

  return { map, exists: true };
}

async function run() {
  await mongoose.connect(uri);
  console.log("[outlet-timings-backfill] connected to MongoDB");

  const { map: legacyByRestaurantId, exists: legacyExists } =
    await getLegacyOutletTimingsMap(mongoose.connection);

  const restaurants = await Restaurant.find({})
    .select("_id openDays deliveryTimings weeklyTimings outletTimingsActive onboarding.step2.openDays")
    .lean();

  if (restaurants.length === 0) {
    console.log("[outlet-timings-backfill] no restaurants found");
    await mongoose.disconnect();
    return;
  }

  const ops = [];
  let migratedFromLegacy = 0;
  let initializedFromFallback = 0;
  let alreadyEmbedded = 0;

  for (const restaurant of restaurants) {
    const fallbackWeekly = buildFallbackWeekly(restaurant);
    const legacy = legacyByRestaurantId.get(String(restaurant._id));
    const sourceWeekly =
      Array.isArray(restaurant.weeklyTimings) && restaurant.weeklyTimings.length > 0
        ? restaurant.weeklyTimings
        : legacy?.timings;
    const nextWeekly = normalizeWeeklyTimings(sourceWeekly, fallbackWeekly);
    const nextOpenDays = openDaysFromWeekly(nextWeekly);
    const nextIsActive =
      typeof restaurant.outletTimingsActive === "boolean"
        ? restaurant.outletTimingsActive
        : legacy?.isActive !== false;

    const changed =
      JSON.stringify(restaurant.weeklyTimings || []) !== JSON.stringify(nextWeekly) ||
      JSON.stringify(restaurant.openDays || []) !== JSON.stringify(nextOpenDays) ||
      restaurant.outletTimingsActive !== nextIsActive ||
      JSON.stringify(restaurant?.onboarding?.step2?.openDays || []) !== JSON.stringify(nextOpenDays);

    if (changed) {
      ops.push({
        updateOne: {
          filter: { _id: restaurant._id },
          update: {
            $set: {
              weeklyTimings: nextWeekly,
              outletTimingsActive: nextIsActive,
              openDays: nextOpenDays,
              "onboarding.step2.openDays": nextOpenDays,
            },
          },
        },
      });
    }

    if (Array.isArray(restaurant.weeklyTimings) && restaurant.weeklyTimings.length > 0) {
      alreadyEmbedded += 1;
    } else if (legacy?.timings) {
      migratedFromLegacy += 1;
    } else {
      initializedFromFallback += 1;
    }
  }

  if (ops.length > 0) {
    await Restaurant.bulkWrite(ops, { ordered: false });
  }

  if (legacyExists) {
    await mongoose.connection.db.collection("outlettimings").drop();
    console.log("[outlet-timings-backfill] dropped legacy collection: outlettimings");
  }

  console.log(
    `[outlet-timings-backfill] processed=${restaurants.length} updated=${ops.length} migratedFromLegacy=${migratedFromLegacy} initializedFromFallback=${initializedFromFallback} alreadyEmbedded=${alreadyEmbedded}`,
  );

  await mongoose.disconnect();
  console.log("[outlet-timings-backfill] done");
}

run().catch(async (error) => {
  console.error("[outlet-timings-backfill] failed:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

