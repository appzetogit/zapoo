import mongoose from 'mongoose';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Challenge from '../models/Challenge.js';
import ChallengeTemplate from '../models/ChallengeTemplate.js';
import ChallengeProgress from '../models/ChallengeProgress.js';

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'];
const VALID_OPERATORS = ['>=', '<=', '=='];
const VALID_TARGET_TYPES = ['restaurant', 'delivery_partner'];
const VALID_REWARD_TYPES = ['wallet_credit', 'bonus', 'featured_listing', 'ad_credits', 'wallet', 'badge', 'free_banner'];
const RESTAURANT_REWARD_TYPES = ['wallet_credit', 'free_banner'];
const VALID_METRIC_KEYS = [
  'order_count',
  'order_revenue',
  'average_rating',
  'new_customer_count',
  'delivery_count',
  'acceptance_rate',
  'active_days',
  'weekly_delivery_count'
];

const DEFAULT_TEMPLATES = [
  { name: 'restaurant_order_count', metricKey: 'order_count', targetType: 'restaurant', description: 'Complete a target number of delivered orders.' },
  { name: 'restaurant_revenue_target', metricKey: 'order_revenue', targetType: 'restaurant', description: 'Reach a target delivered order revenue.' },
  { name: 'restaurant_rating_threshold', metricKey: 'average_rating', targetType: 'restaurant', description: 'Maintain a minimum average rating.' },
  { name: 'restaurant_new_customer_count', metricKey: 'new_customer_count', targetType: 'restaurant', description: 'Serve target number of new customers.' },
  { name: 'partner_delivery_count', metricKey: 'delivery_count', targetType: 'delivery_partner', description: 'Complete target number of deliveries.' },
  { name: 'partner_acceptance_rate', metricKey: 'acceptance_rate', targetType: 'delivery_partner', description: 'Maintain delivery acceptance rate target.' },
  { name: 'partner_active_days', metricKey: 'active_days', targetType: 'delivery_partner', description: 'Be active on target number of days.' }
];

const normalizeTierIds = (tierIds = []) => {
  if (!Array.isArray(tierIds)) return [];
  return [...new Set(
    tierIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id).toString())
  )].map((id) => new mongoose.Types.ObjectId(id));
};

const normalizeTargetType = (targetType) => {
  if (targetType === 'partner') return 'delivery_partner';
  return targetType;
};

const normalizeRewardType = (rewardType) => {
  if (rewardType === 'wallet') return 'wallet_credit';
  return rewardType;
};

const validateRewardTypeForTarget = ({ normalizedRewardType, targetType }) => {
  if (targetType !== 'restaurant') return true;
  return RESTAURANT_REWARD_TYPES.includes(normalizedRewardType);
};

const ensureTemplates = async () => {
  const ops = DEFAULT_TEMPLATES.map((template) => ({
    updateOne: {
      filter: { targetType: template.targetType, metricKey: template.metricKey },
      update: {
        $setOnInsert: template
      },
      upsert: true
    }
  }));
  if (ops.length) await ChallengeTemplate.bulkWrite(ops, { ordered: false });
};

const resolveTemplate = async ({ templateId, templateName, metricKey, targetType }) => {
  if (templateId && mongoose.Types.ObjectId.isValid(templateId)) {
    return ChallengeTemplate.findById(templateId).lean();
  }

  if (templateName) {
    return ChallengeTemplate.findOne({ name: templateName, targetType }).lean();
  }

  if (metricKey) {
    return ChallengeTemplate.findOne({ metricKey, targetType }).lean();
  }

  return null;
};

const validateMetricForType = (metricKey, targetType) => {
  const restaurantMetrics = ['order_count', 'order_revenue', 'average_rating', 'new_customer_count'];
  const partnerMetrics = ['delivery_count', 'acceptance_rate', 'active_days', 'weekly_delivery_count'];
  if (targetType === 'restaurant') return restaurantMetrics.includes(metricKey);
  return partnerMetrics.includes(metricKey);
};

const getAutoWindowForFrequency = (frequency, now = new Date()) => {
  const start = new Date(now);
  const end = new Date(start);

  if (frequency === 'daily') {
    end.setTime(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  } else if (frequency === 'weekly') {
    end.setTime(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  } else if (frequency === 'monthly') {
    const month = end.getMonth();
    end.setMonth(month + 1);
    end.setTime(end.getTime() - 1);
  }

  return { start, end };
};

export const getChallengeTemplates = asyncHandler(async (req, res) => {
  await ensureTemplates();

  const requestedType = normalizeTargetType(req.query.target_type || req.query.targetType);
  const query = {};
  if (requestedType && VALID_TARGET_TYPES.includes(requestedType)) {
    query.targetType = requestedType;
  }

  let templates = await ChallengeTemplate.find(query)
    .select('name metricKey targetType description createdAt')
    .sort({ targetType: 1, name: 1 })
    .lean();

  // Hide deprecated delivery-partner weekly delivery template from API consumers
  templates = templates.filter(
    (t) => !(t.name === 'partner_weekly_delivery_target' || t.metricKey === 'weekly_delivery_count')
  );

  return successResponse(res, 200, 'Challenge templates fetched successfully', { templates });
});

export const createChallenge = asyncHandler(async (req, res) => {
  await ensureTemplates();

  const title = req.body.title ?? req.body.challenge_name;
  const targetType = normalizeTargetType(req.body.target_type ?? req.body.targetType ?? req.body.applicable_user_type);
  const templateId = req.body.template_id ?? req.body.templateId;
  const metricKeyInput = req.body.metric_key ?? req.body.metricKey;
  const frequency = req.body.frequency;
  const operator = req.body.operator ?? '>=';
  const targetValue = Number(req.body.target_value ?? req.body.targetValue);
  const rawRewardType = req.body.reward_type ?? req.body.rewardType;
  const rewardType = normalizeRewardType(rawRewardType);
  const rewardValue = Number(req.body.reward_value ?? req.body.rewardValue);
  const tiers = req.body.tiers ?? req.body.tier_ids ?? [];
  const { start: autoStart, end: autoEnd } = getAutoWindowForFrequency(frequency);

  if (!title?.trim()) return errorResponse(res, 400, 'title is required');
  if (!VALID_TARGET_TYPES.includes(targetType)) return errorResponse(res, 400, 'Invalid target_type');
  if (!VALID_FREQUENCIES.includes(frequency)) return errorResponse(res, 400, 'Invalid frequency');
  if (!VALID_OPERATORS.includes(operator)) return errorResponse(res, 400, 'Invalid operator');
  if (!VALID_REWARD_TYPES.includes(rewardType)) return errorResponse(res, 400, 'Invalid reward_type');
  if (!validateRewardTypeForTarget({ normalizedRewardType: rewardType, targetType })) {
    return errorResponse(res, 400, 'reward_type is not valid for target_type');
  }
  if (!Number.isFinite(targetValue) || targetValue < 0) return errorResponse(res, 400, 'target_value must be >= 0');
  if (!Number.isFinite(rewardValue) || rewardValue < 0) return errorResponse(res, 400, 'reward_value must be >= 0');

  const template = await resolveTemplate({
    templateId,
    templateName: req.body.template_name ?? req.body.templateName,
    metricKey: metricKeyInput,
    targetType
  });

  const metricKey = template?.metricKey || metricKeyInput;
  if (!VALID_METRIC_KEYS.includes(metricKey)) return errorResponse(res, 400, 'Invalid metric_key');
  if (!validateMetricForType(metricKey, targetType)) return errorResponse(res, 400, 'metric_key is not valid for target_type');

  const challenge = await Challenge.create({
    templateId: template?._id || null,
    challengeName: title.trim(),
    applicableUserType: targetType,
    tierIds: normalizeTierIds(tiers),
    frequency,
    metricKey,
    operator,
    targetValue,
    rewardType,
    rewardValue,
    startDate: autoStart,
    endDate: autoEnd,
    status: 'active',
    createdBy: req.user?._id || req.user?.id
  });

  const hydrated = await Challenge.findById(challenge._id)
    .populate('templateId', 'name metricKey targetType description')
    .populate('tierIds', 'name rank')
    .lean();

  return successResponse(res, 201, 'Challenge created successfully', { challenge: hydrated });
});

export const getChallenges = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, target_type, frequency } = req.query;
  const query = { rewardType: { $ne: 'top_10' } };

  if (status) query.status = status;
  if (target_type) query.applicableUserType = normalizeTargetType(target_type);
  if (frequency) query.frequency = frequency;

  const skip = (Number(page) - 1) * Number(limit);
  const [challenges, total] = await Promise.all([
    Challenge.find(query)
      .populate('templateId', 'name metricKey targetType description')
      .populate('tierIds', 'name rank')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Challenge.countDocuments(query)
  ]);

  return successResponse(res, 200, 'Challenges fetched successfully', {
    challenges,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
});

export const getChallengeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, 'Invalid challenge id');

  const challenge = await Challenge.findById(id)
    .populate('templateId', 'name metricKey targetType description')
    .populate('tierIds', 'name rank')
    .lean();
  if (!challenge) return errorResponse(res, 404, 'Challenge not found');
  if (challenge.rewardType === 'top_10') return errorResponse(res, 404, 'Challenge not found');

  return successResponse(res, 200, 'Challenge fetched successfully', { challenge });
});

export const updateChallenge = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, 'Invalid challenge id');

  const challenge = await Challenge.findById(id);
  if (!challenge) return errorResponse(res, 404, 'Challenge not found');

  const title = req.body.title ?? req.body.challenge_name;
  const targetTypeRaw = req.body.target_type ?? req.body.targetType ?? req.body.applicable_user_type;
  const targetType = targetTypeRaw ? normalizeTargetType(targetTypeRaw) : challenge.applicableUserType;
  const templateId = req.body.template_id ?? req.body.templateId;
  const metricKeyInput = req.body.metric_key ?? req.body.metricKey;
  const rewardTypeInput = req.body.reward_type ?? req.body.rewardType;
  const tiers = req.body.tiers ?? req.body.tier_ids;

  if (title !== undefined) challenge.challengeName = String(title).trim();
  if (targetTypeRaw !== undefined) {
    if (!VALID_TARGET_TYPES.includes(targetType)) return errorResponse(res, 400, 'Invalid target_type');
    challenge.applicableUserType = targetType;
  }

  const frequencyChanged = req.body.frequency !== undefined && req.body.frequency !== challenge.frequency;
  if (req.body.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(req.body.frequency)) return errorResponse(res, 400, 'Invalid frequency');
    challenge.frequency = req.body.frequency;
  }

  if (req.body.operator !== undefined) {
    if (!VALID_OPERATORS.includes(req.body.operator)) return errorResponse(res, 400, 'Invalid operator');
    challenge.operator = req.body.operator;
  }

  if (req.body.target_value !== undefined || req.body.targetValue !== undefined) {
    const targetValue = Number(req.body.target_value ?? req.body.targetValue);
    if (!Number.isFinite(targetValue) || targetValue < 0) return errorResponse(res, 400, 'target_value must be >= 0');
    challenge.targetValue = targetValue;
  }

  if (rewardTypeInput !== undefined) {
    const rewardType = normalizeRewardType(rewardTypeInput);
    if (!VALID_REWARD_TYPES.includes(rewardType)) return errorResponse(res, 400, 'Invalid reward_type');
    if (!validateRewardTypeForTarget({ normalizedRewardType: rewardType, targetType: challenge.applicableUserType })) {
      return errorResponse(res, 400, 'reward_type is not valid for target_type');
    }
    challenge.rewardType = rewardType;
  }

  if (req.body.reward_value !== undefined || req.body.rewardValue !== undefined) {
    const rewardValue = Number(req.body.reward_value ?? req.body.rewardValue);
    if (!Number.isFinite(rewardValue) || rewardValue < 0) return errorResponse(res, 400, 'reward_value must be >= 0');
    challenge.rewardValue = rewardValue;
  }

  if (frequencyChanged) {
    const { start, end } = getAutoWindowForFrequency(challenge.frequency, new Date());
    challenge.startDate = start;
    challenge.endDate = end;
  }
  if (req.body.status !== undefined) challenge.status = req.body.status;
  if (tiers !== undefined) challenge.tierIds = normalizeTierIds(tiers);

  if (templateId !== undefined || metricKeyInput !== undefined) {
    const template = await resolveTemplate({
      templateId: templateId ?? challenge.templateId?.toString(),
      templateName: req.body.template_name ?? req.body.templateName,
      metricKey: metricKeyInput ?? challenge.metricKey,
      targetType: challenge.applicableUserType
    });
    const metricKey = template?.metricKey || metricKeyInput || challenge.metricKey;
    if (!VALID_METRIC_KEYS.includes(metricKey)) return errorResponse(res, 400, 'Invalid metric_key');
    if (!validateMetricForType(metricKey, challenge.applicableUserType)) {
      return errorResponse(res, 400, 'metric_key is not valid for target_type');
    }
    challenge.templateId = template?._id || null;
    challenge.metricKey = metricKey;
  } else if (!validateMetricForType(challenge.metricKey, challenge.applicableUserType)) {
    return errorResponse(res, 400, 'metric_key is not valid for target_type');
  }

  if (!validateRewardTypeForTarget({ normalizedRewardType: challenge.rewardType, targetType: challenge.applicableUserType })) {
    return errorResponse(res, 400, 'reward_type is not valid for target_type');
  }

  challenge.updatedBy = req.user?._id || req.user?.id;
  await challenge.save();

  const hydrated = await Challenge.findById(challenge._id)
    .populate('templateId', 'name metricKey targetType description')
    .populate('tierIds', 'name rank')
    .lean();

  return successResponse(res, 200, 'Challenge updated successfully', { challenge: hydrated });
});

export const updateChallengeStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, 'Invalid challenge id');
  if (!['active', 'inactive'].includes(status)) return errorResponse(res, 400, 'Invalid status');

  const challenge = await Challenge.findById(id);
  if (!challenge) return errorResponse(res, 404, 'Challenge not found');

  challenge.status = status;
  challenge.updatedBy = req.user?._id || req.user?.id;
  await challenge.save();
  return successResponse(res, 200, 'Challenge status updated successfully', { challenge });
});

export const getAllChallengeProgress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, 400, 'Invalid challenge id');

  const challenge = await Challenge.findById(id).lean();
  if (!challenge) return errorResponse(res, 404, 'Challenge not found');
  if (challenge.rewardType === 'top_10') return errorResponse(res, 404, 'Challenge not found');

  const skip = (Number(page) - 1) * Number(limit);
  const [progress, total] = await Promise.all([
    ChallengeProgress.find({ challengeId: id })
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ChallengeProgress.countDocuments({ challengeId: id })
  ]);

  return successResponse(res, 200, 'Challenge progress fetched successfully', {
    progress,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
});
