import mongoose from 'mongoose';
import Challenge from '../../admin/models/Challenge.js';
import ChallengeProgress from '../../admin/models/ChallengeProgress.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';
import Zone from '../../admin/models/Zone.js';
import Order from '../models/Order.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import RestaurantWallet from '../../restaurant/models/RestaurantWallet.js';
import Top10Restaurant from '../../heroBanner/models/Top10Restaurant.js';
import ChallengeBanner from '../../marketing/models/ChallengeBanner.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getCycleBounds = (frequency, date = new Date()) => {
  const now = new Date(date);

  if (frequency === 'daily') {
    const cycleStart = startOfDay(now);
    const cycleEnd = endOfDay(now);
    const cycleKey = cycleStart.toISOString().slice(0, 10);
    return { cycleStart, cycleEnd, cycleKey };
  }

  if (frequency === 'weekly') {
    const cycleStart = startOfDay(now);
    const day = cycleStart.getDay();
    const diff = cycleStart.getDate() - day + (day === 0 ? -6 : 1);
    cycleStart.setDate(diff);
    const cycleEnd = endOfDay(cycleStart);
    cycleEnd.setDate(cycleStart.getDate() + 6);
    const weekPart = cycleStart.toISOString().slice(0, 10);
    return { cycleStart, cycleEnd, cycleKey: `W-${weekPart}` };
  }

  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const cycleKey = `${cycleStart.getFullYear()}-${String(cycleStart.getMonth() + 1).padStart(2, '0')}`;
  return { cycleStart, cycleEnd, cycleKey };
};

const evaluateOperator = (operator, currentProgress, targetValue) => {
  if (operator === '==') return currentProgress === targetValue;
  if (operator === '<=') return currentProgress <= targetValue;
  return currentProgress >= targetValue;
};

const resolveRestaurant = async (restaurantRef) => {
  if (!restaurantRef) return null;

  if (typeof restaurantRef === 'object' && restaurantRef?._id) {
    return Restaurant.findById(restaurantRef._id).select('_id zoneId rating').lean();
  }

  if (mongoose.Types.ObjectId.isValid(restaurantRef)) {
    const byId = await Restaurant.findById(restaurantRef).select('_id zoneId rating').lean();
    if (byId) return byId;
  }

  return Restaurant.findOne({ restaurantId: String(restaurantRef) }).select('_id zoneId rating').lean();
};

const getTierIdFromZone = async (zoneId) => {
  if (!zoneId || !mongoose.Types.ObjectId.isValid(zoneId)) return null;
  const zone = await Zone.findById(zoneId).select('tierId').lean();
  return zone?.tierId ? zone.tierId.toString() : null;
};

const getRestaurantTierId = async (restaurant) => {
  if (!restaurant?.zoneId) return null;
  return getTierIdFromZone(restaurant.zoneId);
};

const getDeliveryPartnerTierId = async ({ deliveryPartnerId, zoneId }) => {
  const tierFromEventZone = await getTierIdFromZone(zoneId);
  if (tierFromEventZone) return tierFromEventZone;

  if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(deliveryPartnerId)) return null;
  const delivery = await Delivery.findById(deliveryPartnerId).select('availability.zones').lean();
  const zones = Array.isArray(delivery?.availability?.zones) ? delivery.availability.zones : [];
  if (!zones.length) return null;

  const zoneDocs = await Zone.find({ _id: { $in: zones } }).select('tierId').lean();
  const tierIds = zoneDocs
    .map((z) => z?.tierId?.toString())
    .filter(Boolean)
    .sort();
  return tierIds[0] || null;
};

const getMetricKeysForEvent = (eventType, userType) => {
  if (eventType === 'order_completed' && userType === 'restaurant') {
    return ['order_count', 'order_revenue', 'new_customer_count', 'average_rating'];
  }
  if (eventType === 'delivery_completed' && userType === 'delivery_partner') {
    return ['delivery_count', 'weekly_delivery_count', 'active_days'];
  }
  if ((eventType === 'delivery_accepted' || eventType === 'delivery_rejected') && userType === 'delivery_partner') {
    return ['acceptance_rate', 'active_days'];
  }
  return [];
};

const ensureProgress = async ({ challenge, userId, userType, eventDate }) => {
  const { cycleStart, cycleEnd, cycleKey } = getCycleBounds(challenge.frequency, eventDate);
  return ChallengeProgress.findOneAndUpdate(
    {
      userId,
      challengeId: challenge._id,
      cycleKey
    },
    {
      $setOnInsert: {
        userType,
        cycleStart,
        cycleEnd,
        targetValue: challenge.targetValue,
        rewardType: challenge.rewardType,
        rewardValue: challenge.rewardValue
      }
    },
    { upsert: true, new: true }
  );
};

const updateProgressIncrement = async ({ progressId, amount, eventKey }) => {
  if (!amount || amount <= 0) return null;
  return ChallengeProgress.findOneAndUpdate(
    {
      _id: progressId,
      ...(eventKey ? { processedEventKeys: { $ne: eventKey } } : {})
    },
    {
      ...(eventKey ? { $addToSet: { processedEventKeys: eventKey } } : {}),
      $inc: { currentProgress: amount },
      $set: { lastUpdated: new Date() }
    },
    { new: true }
  );
};

const updateProgressAbsolute = async ({ progressId, value, eventKey }) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return ChallengeProgress.findOneAndUpdate(
    {
      _id: progressId,
      ...(eventKey ? { processedEventKeys: { $ne: eventKey } } : {})
    },
    {
      ...(eventKey ? { $addToSet: { processedEventKeys: eventKey } } : {}),
      $set: {
        currentProgress: Number(value),
        lastUpdated: new Date()
      }
    },
    { new: true }
  );
};

const updateAcceptanceRate = async ({ progressId, eventType, eventKey }) => {
  const inc = eventType === 'delivery_accepted'
    ? { 'meta.acceptedCount': 1 }
    : eventType === 'delivery_rejected'
      ? { 'meta.rejectedCount': 1 }
      : null;
  if (!inc) return null;

  const row = await ChallengeProgress.findOneAndUpdate(
    {
      _id: progressId,
      ...(eventKey ? { processedEventKeys: { $ne: eventKey } } : {})
    },
    {
      ...(eventKey ? { $addToSet: { processedEventKeys: eventKey } } : {}),
      $inc: inc,
      $set: { lastUpdated: new Date() }
    },
    { new: true }
  );
  if (!row) return null;

  const accepted = Number(row?.meta?.acceptedCount || 0);
  const rejected = Number(row?.meta?.rejectedCount || 0);
  const total = accepted + rejected;
  const rate = total > 0 ? (accepted / total) * 100 : 0;

  return ChallengeProgress.findByIdAndUpdate(
    progressId,
    { $set: { currentProgress: Number(rate.toFixed(2)), lastUpdated: new Date() } },
    { new: true }
  );
};

const updateActiveDays = async ({ progressId, eventDate, eventKey }) => {
  const dayKey = startOfDay(eventDate).toISOString().slice(0, 10);
  return ChallengeProgress.findOneAndUpdate(
    {
      _id: progressId,
      'meta.activeDayKeys': { $ne: dayKey },
      ...(eventKey ? { processedEventKeys: { $ne: eventKey } } : {})
    },
    {
      ...(eventKey ? { $addToSet: { processedEventKeys: eventKey } } : {}),
      $addToSet: { 'meta.activeDayKeys': dayKey },
      $inc: { currentProgress: 1 },
      $set: { lastUpdated: new Date() }
    },
    { new: true }
  );
};

const applyRewardIfNeeded = async ({ progress, challenge, userId }) => {
  if (!progress || progress.rewardGranted || progress.status !== 'completed') return;

  const locked = await ChallengeProgress.findOneAndUpdate(
    {
      _id: progress._id,
      rewardGranted: false,
      rewardStatus: { $in: ['none', 'pending'] }
    },
    { $set: { rewardStatus: 'issuing', lastUpdated: new Date() } },
    { new: true }
  );
  if (!locked) return;

  const normalizedRewardType = challenge.rewardType === 'wallet' ? 'wallet_credit' : challenge.rewardType;
  const amount = Number(challenge.rewardValue || 0);
  const description = `Challenge reward ${locked._id.toString()}`;
  const now = new Date();
  const oneDayLater = new Date(now.getTime() + ONE_DAY_MS);

  try {
    if ((normalizedRewardType === 'wallet_credit' || normalizedRewardType === 'bonus') && amount > 0) {
      if (challenge.applicableUserType === 'delivery_partner') {
        const wallet = await DeliveryWallet.findOrCreateByDeliveryId(userId);
        const alreadyCredited = (wallet.transactions || []).some((tx) => tx.description === description);
        if (!alreadyCredited) {
          wallet.addTransaction({
            amount,
            type: 'bonus',
            status: 'Completed',
            description
          });
          wallet.markModified('transactions');
          await wallet.save();
        }
      } else {
        const wallet = await RestaurantWallet.findOrCreateByRestaurantId(userId);
        const alreadyCredited = (wallet.transactions || []).some((tx) => tx.description === description);
        if (!alreadyCredited) {
          wallet.addTransaction({
            amount,
            type: 'bonus',
            status: 'Completed',
            description
          });
          wallet.markModified('transactions');
          await wallet.save();
        }
      }
    }

    if (normalizedRewardType === 'top_10' && challenge.applicableUserType === 'restaurant') {
      const existing = await Top10Restaurant.findOne({
        restaurant: userId,
        source: 'challenge',
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
      });
      if (!existing) {
        const maxOrder = await Top10Restaurant.findOne().sort({ order: -1 }).select('order').lean();
        await Top10Restaurant.create({
          restaurant: userId,
          rank: 10,
          order: (maxOrder?.order ?? 0) + 1,
          source: 'challenge',
          expiresAt: oneDayLater,
          isActive: true
        });
      }
    }

    if (normalizedRewardType === 'free_banner' && challenge.applicableUserType === 'restaurant') {
      const restaurant = await Restaurant.findById(userId)
        .select('zoneId profileImage name')
        .lean();
      if (restaurant?.zoneId) {
        const existing = await ChallengeBanner.findOne({
          restaurant: userId,
          endDate: { $gt: now }
        });
        if (!existing) {
          const bannerImage =
            typeof restaurant.profileImage === 'string'
              ? restaurant.profileImage
              : restaurant.profileImage?.url ?? null;
          await ChallengeBanner.create({
            restaurant: userId,
            zoneId: restaurant.zoneId,
            startDate: now,
            endDate: oneDayLater,
            title: challenge.challengeName || 'Challenge Reward',
            description: 'You earned this spotlight!',
            bannerImage,
            redirectTarget: 'menu',
            challengeProgressId: locked._id
          });
        }
      }
    }

    await ChallengeProgress.findByIdAndUpdate(locked._id, {
      $set: {
        rewardGranted: true,
        rewardGrantedAt: now,
        rewardStatus: 'issued',
        rewardAmount: amount,
        lastUpdated: now
      }
    });
  } catch (error) {
    await ChallengeProgress.findByIdAndUpdate(locked._id, {
      $set: { rewardStatus: 'pending', lastUpdated: new Date() }
    });
  }
};

const maybeCompleteChallenge = async ({ progress, challenge, userId }) => {
  if (!progress || progress.status === 'completed') return;
  const isComplete = evaluateOperator(challenge.operator, progress.currentProgress, challenge.targetValue);
  if (!isComplete) return;

  const completed = await ChallengeProgress.findOneAndUpdate(
    { _id: progress._id, status: 'active' },
    {
      $set: {
        status: 'completed',
        rewardStatus: 'pending',
        rewardAmount: challenge.rewardValue,
        completedAt: new Date(),
        lastUpdated: new Date()
      }
    },
    { new: true }
  );

  if (completed) {
    await applyRewardIfNeeded({ progress: completed, challenge, userId });
  }
};

const resolveMetricUpdate = async ({ challenge, eventType, eventData, progressId }) => {
  if (challenge.metricKey === 'order_count' && eventType === 'order_completed') {
    return updateProgressIncrement({ progressId, amount: 1, eventKey: eventData.eventKey });
  }

  if (challenge.metricKey === 'order_revenue' && eventType === 'order_completed') {
    return updateProgressIncrement({ progressId, amount: Number(eventData.revenue || 0), eventKey: eventData.eventKey });
  }

  if (challenge.metricKey === 'new_customer_count' && eventType === 'order_completed') {
    return updateProgressIncrement({ progressId, amount: eventData.isNewCustomer ? 1 : 0, eventKey: eventData.eventKey });
  }

  if (challenge.metricKey === 'average_rating' && eventType === 'order_completed') {
    return updateProgressAbsolute({ progressId, value: Number(eventData.restaurantRating || 0), eventKey: eventData.eventKey });
  }

  if (challenge.metricKey === 'delivery_count' && eventType === 'delivery_completed') {
    return updateProgressIncrement({ progressId, amount: 1, eventKey: eventData.eventKey });
  }

  if (challenge.metricKey === 'weekly_delivery_count' && eventType === 'delivery_completed') {
    return updateProgressIncrement({ progressId, amount: 1, eventKey: eventData.eventKey });
  }

  if (challenge.metricKey === 'acceptance_rate' && (eventType === 'delivery_accepted' || eventType === 'delivery_rejected')) {
    return updateAcceptanceRate({ progressId, eventType, eventKey: eventData.eventKey });
  }

  if (challenge.metricKey === 'active_days' && ['delivery_completed', 'delivery_accepted', 'delivery_rejected'].includes(eventType)) {
    return updateActiveDays({ progressId, eventDate: eventData.eventDate, eventKey: eventData.eventKey });
  }

  return null;
};

const evaluateChallengesForUserEvent = async ({
  userId,
  userType,
  tierId,
  eventType,
  eventDate = new Date(),
  eventData = {}
}) => {
  if (!userId) return;

  const metricKeys = getMetricKeysForEvent(eventType, userType);
  if (!metricKeys.length) return;

  const now = new Date(eventDate);
  const query = {
    applicableUserType: userType,
    status: 'active',
    metricKey: { $in: metricKeys },
    startDate: { $lte: now },
    endDate: { $gte: now }
  };

  if (tierId) {
    query.$or = [{ tierIds: { $size: 0 } }, { tierIds: new mongoose.Types.ObjectId(tierId) }];
  } else {
    query.tierIds = { $size: 0 };
  }

  const challenges = await Challenge.find(query)
    .select('frequency metricKey operator targetValue rewardType rewardValue applicableUserType challengeName')
    .lean();
  if (!challenges.length) return;

  for (const challenge of challenges) {
    const baseProgress = await ensureProgress({
      challenge,
      userId,
      userType,
      eventDate: now
    });

    const updated = await resolveMetricUpdate({
      challenge,
      eventType,
      eventData: { ...eventData, eventDate: now },
      progressId: baseProgress._id
    });

    if (!updated) continue;
    await maybeCompleteChallenge({ progress: updated, challenge, userId });
  }
};

export const evaluateChallengesOnOrderCompleted = async (order) => {
  if (!order || order.status !== 'delivered') return;

  const eventDate = order.deliveredAt || new Date();
  const revenue = Math.max(0, Number(order?.pricing?.subtotal || 0) - Number(order?.pricing?.discount || 0));
  const orderObjectId = order._id?.toString?.() || order.id || order.orderId;
  const eventKey = `order_completed:${orderObjectId}`;

  const restaurant = await resolveRestaurant(order.restaurantId);
  if (!restaurant?._id) return;

  const tierId = await getRestaurantTierId(restaurant);
  const customerOrderCount = await Order.countDocuments({
    userId: order.userId,
    restaurantId: order.restaurantId,
    status: 'delivered'
  });
  const isNewCustomer = customerOrderCount <= 1;

  await evaluateChallengesForUserEvent({
    userId: restaurant._id,
    userType: 'restaurant',
    tierId,
    eventType: 'order_completed',
    eventDate,
    eventData: {
      eventKey,
      revenue,
      isNewCustomer,
      restaurantRating: Number(restaurant.rating || 0)
    }
  });
};

export const evaluateChallengesOnDeliveryCompleted = async (order) => {
  if (!order || order.status !== 'delivered' || !order.deliveryPartnerId) return;
  const eventDate = order.deliveredAt || new Date();
  const orderObjectId = order._id?.toString?.() || order.id || order.orderId;
  const eventKey = `delivery_completed:${orderObjectId}`;
  const tierId = await getDeliveryPartnerTierId({
    deliveryPartnerId: order.deliveryPartnerId,
    zoneId: order?.assignmentInfo?.zoneId
  });

  await evaluateChallengesForUserEvent({
    userId: order.deliveryPartnerId,
    userType: 'delivery_partner',
    tierId,
    eventType: 'delivery_completed',
    eventDate,
    eventData: { eventKey }
  });
};

export const evaluateChallengesOnDeliveryAccepted = async ({ orderId, deliveryPartnerId, eventDate = new Date(), zoneId = null }) => {
  if (!deliveryPartnerId) return;
  const eventKey = `delivery_accepted:${String(orderId)}:${String(deliveryPartnerId)}`;
  const tierId = await getDeliveryPartnerTierId({ deliveryPartnerId, zoneId });

  await evaluateChallengesForUserEvent({
    userId: deliveryPartnerId,
    userType: 'delivery_partner',
    tierId,
    eventType: 'delivery_accepted',
    eventDate,
    eventData: { eventKey }
  });
};

export const evaluateChallengesOnDeliveryRejected = async ({ orderId, deliveryPartnerId, eventDate = new Date(), zoneId = null }) => {
  if (!deliveryPartnerId) return;
  const eventKey = `delivery_rejected:${String(orderId)}:${String(deliveryPartnerId)}`;
  const tierId = await getDeliveryPartnerTierId({ deliveryPartnerId, zoneId });

  await evaluateChallengesForUserEvent({
    userId: deliveryPartnerId,
    userType: 'delivery_partner',
    tierId,
    eventType: 'delivery_rejected',
    eventDate,
    eventData: { eventKey }
  });
};

export const getMyChallengeProgress = async ({ userId, userType, now = new Date() }) => {
  const query = {
    applicableUserType: userType,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  };

  let tierId = null;
  if (userType === 'restaurant') {
    const restaurant = await resolveRestaurant(userId);
    tierId = await getRestaurantTierId(restaurant);
  } else if (userType === 'delivery_partner') {
    tierId = await getDeliveryPartnerTierId({ deliveryPartnerId: userId });
  }

  if (tierId) {
    query.$or = [{ tierIds: { $size: 0 } }, { tierIds: new mongoose.Types.ObjectId(tierId) }];
  } else {
    query.tierIds = { $size: 0 };
  }

  const challenges = await Challenge.find(query)
    .populate('templateId', 'name metricKey targetType description')
    .select(
      'templateId challengeName applicableUserType tierIds frequency metricKey operator targetValue rewardType rewardValue startDate endDate status'
    )
    .sort({ createdAt: -1 })
    .lean();

  if (!challenges.length) return [];

  const challengeIds = challenges.map((c) => c._id);
  const cycleKeys = [...new Set(challenges.map((challenge) => getCycleBounds(challenge.frequency, now).cycleKey))];

  const progressRows = await ChallengeProgress.find({
    userId,
    challengeId: { $in: challengeIds },
    cycleKey: { $in: cycleKeys }
  })
    .select('challengeId cycleKey currentProgress targetValue status rewardStatus rewardAmount rewardGranted completedAt lastUpdated')
    .lean();

  const progressMap = new Map();
  for (const row of progressRows) {
    progressMap.set(`${row.challengeId.toString()}__${row.cycleKey}`, row);
  }

  return challenges.map((challenge) => {
    const cycle = getCycleBounds(challenge.frequency, now);
    const key = `${challenge._id.toString()}__${cycle.cycleKey}`;
    const progress = progressMap.get(key);

    return {
      ...challenge,
      cycleKey: cycle.cycleKey,
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      progress: progress
        ? {
            currentProgress: progress.currentProgress,
            targetValue: progress.targetValue,
            status: progress.status,
            rewardStatus: progress.rewardStatus,
            rewardAmount: progress.rewardAmount,
            rewardGranted: Boolean(progress.rewardGranted),
            completedAt: progress.completedAt,
            lastUpdated: progress.lastUpdated
          }
        : {
            currentProgress: 0,
            targetValue: challenge.targetValue,
            status: 'active',
            rewardStatus: 'none',
            rewardAmount: 0,
            rewardGranted: false,
            completedAt: null,
            lastUpdated: null
          }
    };
  });
};
