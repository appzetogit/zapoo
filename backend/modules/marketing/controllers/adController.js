import mongoose from 'mongoose';
import AdRequest from '../models/AdRequest.js';
import ChallengeBanner from '../models/ChallengeBanner.js';
import { createOrder, verifyPayment } from '../../payment/services/razorpayService.js';
import express from 'express';
import Zone from '../../admin/models/Zone.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
import { calculateDistance } from '../../order/services/orderCalculationService.js';
import { getRazorpayCredentials } from '../../../shared/utils/envService.js';
import {
  countAvailableFreeBannerCredits,
  reserveOldestAvailableFreeBannerCredit,
  markReservedCreditAsConsumed,
  releaseReservedFreeBannerCredit
} from '../services/freeBannerCreditService.js';
import { notifyAdminsAdPaymentCompleted } from '../services/adAdminNotificationService.js';

const DEFAULT_BANNER_PRICE_PER_DAY = 500;

// NOTE: Slot-based capacity (max banners per tier/zone) has been removed.
// Ads are no longer limited by per-day slot counts; only dates and status
// determine eligibility.
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';

const FREE_BANNER_MESSAGE = 'You have won a free day banner';

const adPaymentDebug = (step, meta = {}) => {
  try {
    console.log('[AD_PAYMENT_DEBUG]', step, meta);
  } catch (_) {
    // no-op
  }
};

const parseCampaignDate = (input) => {
  if (!input) return null;

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input;
  }

  const raw = String(input).trim();

  // Support yyyy-mm-dd (web) deterministically in local time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split('-').map(Number);
    const date = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Support dd-mm-yyyy (common in mobile forms / custom date pickers).
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('-').map(Number);
    const date = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

const getISTDayBoundsFromDate = (date) => {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();

  const startUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endUtcMs = Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS;

  return {
    dayStart: new Date(startUtcMs),
    dayEnd: new Date(endUtcMs)
  };
};

const normalizeToDayStart = (date) => getISTDayBoundsFromDate(date).dayStart;
const normalizeToDayEnd = (date) => getISTDayBoundsFromDate(date).dayEnd;

const getRestaurantLatLng = (restaurantDoc) => {
  const lat = restaurantDoc?.location?.latitude ?? restaurantDoc?.location?.coordinates?.[1];
  const lng = restaurantDoc?.location?.longitude ?? restaurantDoc?.location?.coordinates?.[0];

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
};

const collectInRangeRestaurantIds = async ({ userLat, userLng, maxRangeMeters }) => {
  const maxRangeKm = maxRangeMeters / 1000;
  const inRangeIds = new Set();

  const includeIfInRange = (restaurantDoc) => {
    const coords = getRestaurantLatLng(restaurantDoc);
    if (!coords) return;

    const distanceKm = calculateDistance([coords.lng, coords.lat], [userLng, userLat]);
    const deliveryRangeKm = Number(restaurantDoc?.deliveryRange) || 5;

    if (distanceKm <= maxRangeKm && distanceKm <= deliveryRangeKm) {
      inRangeIds.add(String(restaurantDoc._id));
    }
  };

  try {
    const nearbyRestaurants = await Restaurant.find({
      isActive: true,
      'location.coordinates': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [userLng, userLat] },
          $maxDistance: maxRangeMeters
        }
      }
    }).select('_id deliveryRange location').lean();

    nearbyRestaurants.forEach(includeIfInRange);
  } catch (geoErr) {
    console.warn('⚠️ Marketing geo query failed, continuing with lat/lng fallback:', geoErr.message);
  }

  const missingCoordRestaurants = await Restaurant.find({
    isActive: true,
    'location.latitude': { $ne: null },
    'location.longitude': { $ne: null },
    $or: [
      { 'location.coordinates': { $exists: false } },
      { 'location.coordinates': { $size: 0 } },
      { 'location.coordinates.0': 0, 'location.coordinates.1': 0 }
    ]
  }).select('_id deliveryRange location').lean();

  missingCoordRestaurants.forEach(includeIfInRange);

  return [...inRangeIds].map((id) => new mongoose.Types.ObjectId(id));
};

const buildAdBillingSummary = (ad = {}) => ({
  originalTotalCost: Number(ad.originalTotalCost ?? ad.totalCost ?? 0),
  freeBannerDiscountAmount: Number(ad.freeBannerDiscountAmount || 0),
  finalTotalCost: Number(ad.totalCost || 0),
  hasFreeBannerCreditApplied: Boolean(ad.hasFreeBannerCreditApplied),
  appliedFreeBannerCreditId: ad.appliedFreeBannerCreditId || null,
  billingMessage: ad.billingMessage || null
});

const getCurrentDayBounds = () => {
  return getISTDayBoundsFromDate(new Date());
};

const resolveTierBannerPricePerDay = (tierDoc) => {
  const price = Number(tierDoc?.restaurantBannerPricePerDay);
  if (Number.isFinite(price) && price >= 0) {
    return price;
  }
  return DEFAULT_BANNER_PRICE_PER_DAY;
};

const calculateCampaignPricing = async ({ targetZoneIds, days }) => {
  let totalCost = 0;

  for (const zoneId of targetZoneIds) {
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      const invalidZone = new Error(`Invalid zone ID: ${zoneId}`);
      invalidZone.statusCode = 400;
      throw invalidZone;
    }

    const zone = await Zone.findById(zoneId).populate('tierId');
    if (!zone) {
      const notFound = new Error(`Zone not found: ${zoneId}`);
      notFound.statusCode = 404;
      throw notFound;
    }

    const pricePerDay = resolveTierBannerPricePerDay(zone?.tierId);
    totalCost += pricePerDay * days;
  }

  const normalizedDays = Math.max(1, Number(days) || 1);
  return {
    originalTotalCost: totalCost,
    perDayTotal: totalCost / normalizedDays
  };
};

/**
 * Restaurant submits an ad request
 */
export const createAdRequest = async (req, res) => {
  try {
    adPaymentDebug('create_ad_request_incoming', {
      restaurantId: req.restaurant?._id || req.restaurant?.id || null,
      hasBody: Boolean(req.body),
      bodyKeys: req.body ? Object.keys(req.body) : [],
      startDate: req.body?.startDate || null,
      endDate: req.body?.endDate || null,
      userAgent: req.headers['user-agent'] || null,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null
    });

    const {
      startDate,
      endDate,
      title,
      description,
      redirectTarget
    } = req.body;

    // Normalize targetZones — FormData sends it as 'targetZones[]' or 'targetZones'
    let targetZones = req.body.targetZones || req.body['targetZones[]'] || [];
    if (typeof targetZones === 'string') {
      try {
        // Try parsing if it's a stringified array
        if (targetZones.startsWith('[')) {
          targetZones = JSON.parse(targetZones);
        } else {
          targetZones = [targetZones];
        }
      } catch (e) {
        targetZones = [targetZones];
      }
    }
    if (!Array.isArray(targetZones) || targetZones.length === 0) {
      adPaymentDebug('create_ad_request_invalid_target_zones', {
        receivedTargetZones: targetZones
      });
      return res.status(400).json({
        success: false,
        message: 'At least one target zone must be selected'
      });
    }
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    if (!restaurantId) {
      console.error('❌ [createAdRequest] Missing restaurantId');
      adPaymentDebug('create_ad_request_missing_restaurant', {
        hasRestaurantObject: Boolean(req.restaurant)
      });
      return res.status(401).json({
        success: false,
        message: 'Restaurant authentication required'
      });
    }

    // Convert targetZones to ObjectIds for reliable querying
    const targetZoneIds = targetZones.map(id => new mongoose.Types.ObjectId(id));
    const parsedStart = parseCampaignDate(startDate);
    const parsedEnd = parseCampaignDate(endDate);
    const start = parsedStart ? normalizeToDayStart(parsedStart) : null;
    const end = parsedEnd ? normalizeToDayEnd(parsedEnd) : null;
    if (!start || !end) {
      adPaymentDebug('create_ad_request_invalid_dates', {
        startDateRaw: startDate || null,
        endDateRaw: endDate || null
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid start or end date'
      });
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    if (normalizedStart <= today) {
      adPaymentDebug('create_ad_request_start_date_too_early', {
        normalizedStart,
        today
      });
      return res.status(400).json({
        success: false,
        message: 'Campaigns must be requested at least one day in advance.'
      });
    }
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (isNaN(days) || days <= 0) {
      adPaymentDebug('create_ad_request_invalid_day_range', {
        start,
        end,
        days
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid date range'
      });
    }

    // Limit: Check if restaurant already has an active/approved/scheduled campaign in these zones for these dates
    // concurrency check
    const overlappingOwnAds = await AdRequest.find({
      restaurant: restaurantId,
      targetZones: {
        $in: targetZoneIds
      },
      status: {
        $in: ['Approved', 'Scheduled', 'Active', 'Banner Pending']
      },
      $or: [{
        startDate: {
          $lte: end
        },
        endDate: {
          $gte: start
        }
      } // Dates overlap
      ]
    });
    if (overlappingOwnAds.length > 0) {
      adPaymentDebug('create_ad_request_overlap_conflict', {
        conflictAdId: overlappingOwnAds[0]?._id || null,
        targetZoneIds: targetZoneIds.map((z) => String(z))
      });
      return res.status(409).json({
        success: false,
        message: 'You already have a campaign in this zone for these dates.',
        conflictAd: overlappingOwnAds[0]
      });
    }

    const { originalTotalCost, perDayTotal } = await calculateCampaignPricing({
      targetZoneIds,
      days
    });

    const adRequest = await AdRequest.create({
      restaurant: restaurantId,
      targetZones: targetZoneIds,
      startDate: start,
      endDate: end,
      title,
      description,
      redirectTarget,
      totalCost: originalTotalCost,
      originalTotalCost,
      status: 'Pending'
    });

    let reservedCredit = null;
    try {
      reservedCredit = await reserveOldestAvailableFreeBannerCredit({
        restaurantId,
        adRequestId: adRequest._id
      });

      if (reservedCredit) {
        adRequest.appliedFreeBannerCreditId = reservedCredit._id;
        adRequest.hasFreeBannerCreditApplied = true;
        adRequest.freeBannerDiscountAmount = perDayTotal;
        adRequest.billingMessage = FREE_BANNER_MESSAGE;
        adRequest.totalCost = Math.max(0, originalTotalCost - perDayTotal);
        await adRequest.save();
      }
    } catch (creditError) {
      if (reservedCredit?._id) {
        await releaseReservedFreeBannerCredit({
          creditId: reservedCredit._id,
          adRequestId: adRequest._id
        });
      }
      await AdRequest.findByIdAndDelete(adRequest._id);
      throw creditError;
    }

    const availableFreeBannerCredits = await countAvailableFreeBannerCredits(restaurantId);
    adPaymentDebug('create_ad_request_success', {
      adId: adRequest?._id || null,
      restaurantId: String(restaurantId),
      totalCost: adRequest?.totalCost || 0,
      originalTotalCost: adRequest?.originalTotalCost || 0,
      hasFreeBannerCreditApplied: Boolean(adRequest?.hasFreeBannerCreditApplied),
      availableFreeBannerCredits
    });
    res.status(201).json({
      success: true,
      data: {
        ...adRequest.toObject(),
        ...buildAdBillingSummary(adRequest),
        availableFreeBannerCredits
      },
      message: 'Advertisement request submitted for review'
    });
  } catch (error) {
    console.error('❌ [createAdRequest] CRITICAL ERROR:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error in createAdRequest',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Admin approves or rejects ad request
 */
export const updateAdStatus = async (req, res) => {
  try {
    const {
      adId
    } = req.params;
    const {
      status,
      rejectionReason,
      priority
    } = req.body;
    const normalizedStatus = typeof status === 'string' ? status.trim() : '';
    const hasStatusUpdate = Boolean(normalizedStatus);
    const hasPriorityUpdate = priority !== undefined && priority !== null && String(priority).trim() !== '';

    if (!hasStatusUpdate && !hasPriorityUpdate) {
      return res.status(400).json({
        success: false,
        message: 'Either status or priority is required'
      });
    }

    let normalizedPriority = null;
    if (hasPriorityUpdate) {
      normalizedPriority = Number(priority);
      if (!Number.isInteger(normalizedPriority) || normalizedPriority < 1 || normalizedPriority > 3) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be 1, 2, or 3'
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    const ad = await AdRequest.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }
    if (hasStatusUpdate && normalizedStatus === 'Approved') {
      // Check if approval window is still open (must be approved BEFORE start date)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const adStartDate = new Date(ad.startDate);
      if (adStartDate <= today) {
        if (ad.appliedFreeBannerCreditId && ad.paymentStatus !== 'Paid') {
          await releaseReservedFreeBannerCredit({
            creditId: ad.appliedFreeBannerCreditId,
            adRequestId: ad._id
          });
          ad.appliedFreeBannerCreditId = null;
          ad.hasFreeBannerCreditApplied = false;
          ad.freeBannerDiscountAmount = 0;
          ad.billingMessage = null;
          ad.totalCost = ad.originalTotalCost || ad.totalCost;
        }
        ad.status = 'Rejected';
        ad.rejectionReason = 'Approval window expired (Campaign start date reached or passed)';
        await ad.save();
        return res.status(400).json({
          success: false,
          message: 'Approval window expired. This request has been automatically rejected.'
        });
      }

      ad.status = 'Approved';
      // Payment remains Pending until restaurant pays via Razorpay
      // ad.paymentStatus = 'Paid'; // REMOVED: Auto-pay logic
      ad.approvedBy = req.admin?._id || req.user?._id;
      ad.approvalDate = new Date();
    } else if (hasStatusUpdate && normalizedStatus === 'Rejected') {
      if (ad.appliedFreeBannerCreditId && ad.paymentStatus !== 'Paid') {
        await releaseReservedFreeBannerCredit({
          creditId: ad.appliedFreeBannerCreditId,
          adRequestId: ad._id
        });
        ad.appliedFreeBannerCreditId = null;
        ad.hasFreeBannerCreditApplied = false;
        ad.freeBannerDiscountAmount = 0;
        ad.billingMessage = null;
        ad.totalCost = ad.originalTotalCost || ad.totalCost;
      }
      ad.status = 'Rejected';
      ad.rejectionReason = rejectionReason;
    } else if (hasStatusUpdate) {
      ad.status = normalizedStatus;
    }

    if (hasPriorityUpdate) {
      ad.priority = normalizedPriority;
    }

    await ad.save();

    const messageParts = [];
    if (hasStatusUpdate) messageParts.push(`status updated to ${ad.status}`);
    if (hasPriorityUpdate) messageParts.push(`priority updated to ${ad.priority}`);

    res.status(200).json({
      success: true,
      data: {
        ...ad.toObject(),
        ...buildAdBillingSummary(ad)
      },
      message: messageParts.length ? `Ad ${messageParts.join(' and ')}` : 'Ad updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get active ads for user display by zone (paid ads + challenge reward banners).
 * Optional query: latitude, longitude — when provided, challenge banners are filtered by restaurant.deliveryRange.
 */
export const getActiveAdsByZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { latitude, longitude } = req.query;
    const userLat = latitude != null ? parseFloat(latitude) : null;
    const userLng = longitude != null ? parseFloat(longitude) : null;
    const { dayStart, dayEnd } = getCurrentDayBounds();

    const [paidAds, challengeBanners] = await Promise.all([
      AdRequest.find({
        targetZones: zoneId,
        status: { $in: ['Active', 'Scheduled'] },
        startDate: { $lte: dayEnd },
        endDate: { $gte: dayStart }
      })
        .populate('restaurant', 'name logo address location deliveryRange')
        .limit(20)
        .lean(),
      ChallengeBanner.find({
        zoneId,
        startDate: { $lte: dayEnd },
        endDate: { $gte: dayStart }
      })
        .populate('restaurant', 'name logo address location deliveryRange')
        .lean()
    ]);

    let challengeAds = challengeBanners.map(cb => ({
      _id: cb._id,
      bannerImage: cb.bannerImage,
      title: cb.title,
      description: cb.description,
      redirectTarget: cb.redirectTarget || 'menu',
      restaurant: cb.restaurant,
      source: 'challenge'
    }));

    if (userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng)) {
      challengeAds = challengeAds.filter(ad => {
        const rest = ad.restaurant;
        if (!rest) return false;
        const lat = rest.location?.latitude ?? rest.location?.coordinates?.[1];
        const lng = rest.location?.longitude ?? rest.location?.coordinates?.[0];
        if (lat == null || lng == null) return true;
        const rangeKm = rest.deliveryRange ?? 5;
        const dist = calculateDistance([lng, lat], [userLng, userLat]);
        return dist <= rangeKm;
      });
    }

    // Filter paid ads by restaurant deliveryRange when user coordinates provided
    let paidAdsInRange = paidAds;
    const hasCoords = userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng);
    if (hasCoords) {
      paidAdsInRange = paidAds.filter(ad => {
        const rest = ad.restaurant;
        if (!rest) return false;
        const lat = rest.location?.latitude ?? rest.location?.coordinates?.[1];
        const lng = rest.location?.longitude ?? rest.location?.coordinates?.[0];
        if (lat == null || lng == null) return true;
        const rangeKm = rest.deliveryRange ?? 5;
        const dist = calculateDistance([lng, lat], [userLng, userLat]);
        return dist <= rangeKm;
      });
    }

    // Cross-zone: include ads from nearby restaurants outside the user's zone
    if (hasCoords) {
      const existingAdIds = new Set(paidAdsInRange.map(a => a._id.toString()));
      const existingChallengeIds = new Set(challengeAds.map(a => a._id.toString()));

      const settings = await BusinessSettings.getSettings();
      const maxRangeMeters = (settings.maxDeliveryRange || 20) * 1000;

      const inRangeRestIds = await collectInRangeRestaurantIds({
        userLat,
        userLng,
        maxRangeMeters
      });

      if (inRangeRestIds.length > 0) {
        const [extraPaidAds, extraChallengeBanners] = await Promise.all([
          AdRequest.find({
            restaurant: { $in: inRangeRestIds },
            status: { $in: ['Active', 'Scheduled'] },
            startDate: { $lte: dayEnd },
            endDate: { $gte: dayStart }
          })
            .populate('restaurant', 'name logo address location deliveryRange')
            .limit(20)
            .lean(),
          ChallengeBanner.find({
            restaurant: { $in: inRangeRestIds },
            startDate: { $lte: dayEnd },
            endDate: { $gte: dayStart }
          })
            .populate('restaurant', 'name logo address location deliveryRange')
            .lean()
        ]);

        for (const ad of extraPaidAds) {
          if (!existingAdIds.has(ad._id.toString())) {
            paidAdsInRange.push(ad);
            existingAdIds.add(ad._id.toString());
          }
        }

        for (const cb of extraChallengeBanners) {
          if (!existingChallengeIds.has(cb._id.toString())) {
            challengeAds.push({
              _id: cb._id,
              bannerImage: cb.bannerImage,
              title: cb.title,
              description: cb.description,
              redirectTarget: cb.redirectTarget || 'menu',
              restaurant: cb.restaurant,
              source: 'challenge'
            });
            existingChallengeIds.add(cb._id.toString());
          }
        }
      }
    }

    const combined = [...paidAdsInRange, ...challengeAds].slice(0, 20);

    res.status(200).json({ success: true, data: combined });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get nearby ads for users without a detected zone.
 * Finds ads from restaurants whose deliveryRange covers the user's location.
 * GET /marketing/ads/nearby?latitude=&longitude=
 */
export const getNearbyAds = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    const userLat = latitude != null ? parseFloat(latitude) : null;
    const userLng = longitude != null ? parseFloat(longitude) : null;

    if (userLat == null || userLng == null || !Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { dayStart, dayEnd } = getCurrentDayBounds();

    const settings = await BusinessSettings.getSettings();
    const maxRangeMeters = (settings.maxDeliveryRange || 20) * 1000;

    const inRangeRestIds = await collectInRangeRestaurantIds({
      userLat,
      userLng,
      maxRangeMeters
    });

    if (inRangeRestIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [paidAds, challengeBanners] = await Promise.all([
      AdRequest.find({
        restaurant: { $in: inRangeRestIds },
        status: { $in: ['Active', 'Scheduled'] },
        startDate: { $lte: dayEnd },
        endDate: { $gte: dayStart }
      })
        .populate('restaurant', 'name logo address location deliveryRange')
        .limit(20)
        .lean(),
      ChallengeBanner.find({
        restaurant: { $in: inRangeRestIds },
        startDate: { $lte: dayEnd },
        endDate: { $gte: dayStart }
      })
        .populate('restaurant', 'name logo address location deliveryRange')
        .lean()
    ]);

    const challengeAds = challengeBanners.map(cb => ({
      _id: cb._id,
      bannerImage: cb.bannerImage,
      title: cb.title,
      description: cb.description,
      redirectTarget: cb.redirectTarget || 'menu',
      restaurant: cb.restaurant,
      source: 'challenge'
    }));

    const combined = [...paidAds, ...challengeAds].slice(0, 20);
    res.status(200).json({ success: true, data: combined });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Initiate Razorpay payment for an ad
 */
export const createAdPaymentOrder = async (req, res) => {
  try {
    const {
      adId
    } = req.params;
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    adPaymentDebug('create_payment_order_incoming', {
      adId,
      restaurantId: restaurantId ? String(restaurantId) : null,
      userAgent: req.headers['user-agent'] || null,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null
    });

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      adPaymentDebug('create_payment_order_invalid_ad_id', { adId });
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    const ad = await AdRequest.findOne({
      _id: adId,
      restaurant: restaurantId
    });
    if (!ad) {
      adPaymentDebug('create_payment_order_ad_not_found', {
        adId,
        restaurantId: restaurantId ? String(restaurantId) : null
      });
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }
    if (ad.status !== 'Approved') {
      adPaymentDebug('create_payment_order_ad_not_approved', {
        adId: String(ad._id),
        status: ad.status
      });
      return res.status(400).json({
        success: false,
        message: 'Ad must be Approved before payment'
      });
    }
    if (ad.paymentStatus === 'Paid') {
      adPaymentDebug('create_payment_order_already_paid', {
        adId: String(ad._id),
        paymentStatus: ad.paymentStatus
      });
      return res.status(400).json({
        success: false,
        message: 'Ad is already paid'
      });
    }

    if (Number(ad.totalCost || 0) <= 0) {
      ad.paymentStatus = 'Paid';
      ad.status = 'Banner Pending';
      await ad.save();

      if (ad.appliedFreeBannerCreditId) {
        await markReservedCreditAsConsumed({
          creditId: ad.appliedFreeBannerCreditId,
          adRequestId: ad._id
        });
      }

      adPaymentDebug('create_payment_order_free_activation', {
        adId: String(ad._id),
        totalCost: Number(ad.totalCost || 0),
        paymentStatus: ad.paymentStatus,
        status: ad.status
      });
      return res.status(200).json({
        success: true,
        message: 'Free banner reward applied successfully',
        data: {
          freeActivation: true,
          ad: {
            ...ad.toObject(),
            ...buildAdBillingSummary(ad)
          }
        }
      });
    }

    // Amount in paise
    const amountInPaise = Math.round(ad.totalCost * 100);
    adPaymentDebug('create_payment_order_before_razorpay', {
      adId: String(ad._id),
      totalCostRupees: Number(ad.totalCost || 0),
      amountInPaise,
      previousRazorpayOrderId: ad.razorpayOrderId || null
    });

    const order = await createOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `ad_${ad._id}`,
      notes: {
        adId: ad._id.toString(),
        restaurantId: restaurantId.toString(),
        type: 'AD_CAMPAIGN'
      }
    });
    ad.razorpayOrderId = order.id;
    await ad.save();
    adPaymentDebug('create_payment_order_success', {
      adId: String(ad._id),
      razorpayOrderId: order?.id || null,
      amount: order?.amount || null,
      currency: order?.currency || null
    });

    let razorpayKeyId = '';
    try {
      const credentials = await getRazorpayCredentials();
      razorpayKeyId = credentials?.keyId || process.env.RAZORPAY_API_KEY || '';
    } catch (credError) {
      adPaymentDebug('create_payment_order_key_fetch_error', {
        message: credError?.message || null
      });
      razorpayKeyId = process.env.RAZORPAY_API_KEY || '';
    }

    adPaymentDebug('create_payment_order_key_resolved', {
      hasKey: Boolean(razorpayKeyId),
      keyPrefix: razorpayKeyId ? String(razorpayKeyId).slice(0, 6) : null
    });

    if (!razorpayKeyId) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay key is missing in server configuration'
      });
    }

    adPaymentDebug('create_payment_order_response_sent', {
      adId: String(ad._id),
      orderId: order.id,
      hasKey: Boolean(razorpayKeyId),
      keyPrefix: String(razorpayKeyId).slice(0, 6)
    });

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: razorpayKeyId,
        keyId: razorpayKeyId,
        key_id: razorpayKeyId,
        // Keep parity with order payment response shape for mobile/web shared parsers.
        razorpay: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          key: razorpayKeyId
        }
      }
    });
  } catch (error) {
    console.error('Error creating ad payment order:', error);
    adPaymentDebug('create_payment_order_error', {
      message: error?.message || null,
      stack: error?.stack || null
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Verify Razorpay payment and activate ad
 */
export const verifyAdPayment = async (req, res) => {
  try {
    const adId = req.body.adId || req.body.ad_id;
    const razorpayPaymentId = req.body.razorpayPaymentId || req.body.razorpay_payment_id;
    const razorpaySignature = req.body.razorpaySignature || req.body.razorpay_signature;
    const incomingOrderId = req.body.razorpayOrderId || req.body.razorpay_order_id;
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    adPaymentDebug('verify_payment_incoming', {
      adId,
      adIdSnake: req.body.ad_id || null,
      restaurantId: restaurantId ? String(restaurantId) : null,
      hasRazorpayPaymentIdCamel: Boolean(req.body.razorpayPaymentId),
      hasRazorpayPaymentIdSnake: Boolean(req.body.razorpay_payment_id),
      hasRazorpayOrderIdCamel: Boolean(req.body.razorpayOrderId),
      hasRazorpayOrderIdSnake: Boolean(req.body.razorpay_order_id),
      hasSignatureCamel: Boolean(req.body.razorpaySignature),
      hasSignatureSnake: Boolean(req.body.razorpay_signature),
      bodyKeys: req.body ? Object.keys(req.body) : [],
      userAgent: req.headers['user-agent'] || null,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null
    });

    if (!adId) {
      adPaymentDebug('verify_payment_missing_ad_id', {});
      return res.status(400).json({
        success: false,
        message: 'adId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      adPaymentDebug('verify_payment_invalid_ad_id', { adId });
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    const ad = await AdRequest.findOne({
      _id: adId,
      restaurant: restaurantId
    });
    if (!ad) {
      adPaymentDebug('verify_payment_ad_not_found', {
        adId,
        restaurantId: restaurantId ? String(restaurantId) : null
      });
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }
    if (!ad.razorpayOrderId) {
      adPaymentDebug('verify_payment_missing_saved_order_id', {
        adId: String(ad._id),
        paymentStatus: ad.paymentStatus,
        status: ad.status
      });
      return res.status(400).json({
        success: false,
        message: 'No payment order found for this ad'
      });
    }

    if (!razorpayPaymentId || !razorpaySignature) {
      adPaymentDebug('verify_payment_missing_required_fields', {
        hasPaymentId: Boolean(razorpayPaymentId),
        hasSignature: Boolean(razorpaySignature)
      });
      return res.status(400).json({
        success: false,
        message: 'razorpayPaymentId and razorpaySignature are required'
      });
    }

    if (incomingOrderId && incomingOrderId !== ad.razorpayOrderId) {
      adPaymentDebug('verify_payment_order_mismatch', {
        incomingOrderId,
        savedOrderId: ad.razorpayOrderId
      });
      return res.status(400).json({
        success: false,
        message: 'Razorpay order mismatch for this ad'
      });
    }

    adPaymentDebug('verify_payment_before_signature_check', {
      adId: String(ad._id),
      razorpayOrderId: ad.razorpayOrderId,
      razorpayPaymentId
    });
    const isValid = await verifyPayment(ad.razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      adPaymentDebug('verify_payment_signature_invalid', {
        adId: String(ad._id),
        razorpayOrderId: ad.razorpayOrderId,
        razorpayPaymentId
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    const wasAlreadyPaid = ad.paymentStatus === 'Paid';
    ad.paymentStatus = 'Paid';
    ad.razorpayPaymentId = razorpayPaymentId;
    ad.razorpaySignature = razorpaySignature;
    ad.status = 'Banner Pending';
    await ad.save();
    adPaymentDebug('verify_payment_success', {
      adId: String(ad._id),
      razorpayOrderId: ad.razorpayOrderId,
      razorpayPaymentId: ad.razorpayPaymentId,
      paymentStatus: ad.paymentStatus,
      status: ad.status
    });

    if (ad.appliedFreeBannerCreditId) {
      await markReservedCreditAsConsumed({
        creditId: ad.appliedFreeBannerCreditId,
        adRequestId: ad._id
      });
    }

    if (!wasAlreadyPaid) {
      await notifyAdminsAdPaymentCompleted(ad);
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and ad activated!',
      data: {
        ...ad.toObject(),
        ...buildAdBillingSummary(ad)
      }
    });
  } catch (error) {
    console.error('Error verifying ad payment:', error);
    adPaymentDebug('verify_payment_error', {
      message: error?.message || null,
      stack: error?.stack || null
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Track metrics (existing)
 */
export const trackAdMetric = async (req, res) => {
  try {
    const {
      adId
    } = req.params;
    const {
      type
    } = req.body; // 'impression', 'click', 'order'

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    const updateMap = {
      'impression': 'metrics.impressions',
      'click': 'metrics.clicks',
      'order': 'metrics.orders'
    };
    if (!updateMap[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid metric type'
      });
    }
    const ad = await AdRequest.findByIdAndUpdate(adId, {
      $inc: {
        [updateMap[type]]: 1
      }
    }, {
      new: true
    });
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }
    res.status(200).json({
      success: true,
      data: ad.metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get the restaurant's own zone with pricing (for ad submission)
 * Option B: Restaurant can only advertise in their own zone.
 * Fallback: if zoneId is null, detect zone from lat/lng and auto-heal.
 */
export const getMyZone = async (req, res) => {
  try {
    const restaurant = req.restaurant;
    if (!restaurant) {
      return res.status(401).json({
        success: false,
        message: 'Restaurant authentication required'
      });
    }
    let zoneId = restaurant.zoneId;

    // ── Fallback: detect zone from lat/lng if zoneId is not set ──────────
    if (!zoneId) {
      const lat = restaurant.location?.latitude;
      const lng = restaurant.location?.longitude;
      if (!lat || !lng) {
        return res.status(404).json({
          success: false,
          message: 'Your restaurant has not been assigned to a zone yet. Please complete your location setup in onboarding.'
        });
      }
      const activeZones = await Zone.find({
        isActive: true
      });
      let detectedZone = null;
      for (const zone of activeZones) {
        if (zone.containsPoint(lat, lng)) {
          detectedZone = zone;
          break;
        }
      }
      if (!detectedZone) {
        return res.status(404).json({
          success: false,
          message: 'Your restaurant location does not fall within any active delivery zone. Please contact admin.'
        });
      }

      // Auto-heal: set zoneId on the restaurant so next call is instant
      await Restaurant.findByIdAndUpdate(restaurant._id, {
        $set: {
          zoneId: detectedZone._id
        }
      });
      zoneId = detectedZone._id;
    }
    // ─────────────────────────────────────────────────────────────────────

    const zone = await Zone.findById(zoneId).populate('tierId', 'name rank restaurantBannerPricePerDay');
    if (!zone || !zone.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Your zone is not currently available for advertising.'
      });
    }
    const zoneData = {
      _id: zone._id,
      name: zone.name || zone.zoneName,
      tier: zone.tierId?.name || 'Standard',
      pricePerDay: resolveTierBannerPricePerDay(zone.tierId)
    };
    res.status(200).json({
      success: true,
      data: zoneData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all ad requests (for admin)
 */
export const getAllAdRequests = async (req, res) => {
  try {
    // Auto-reject expired pending requests
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiredPendingAds = await AdRequest.find({
      status: 'Pending',
      startDate: {
        $lte: today
      }
    });

    for (const ad of expiredPendingAds) {
      if (ad.appliedFreeBannerCreditId && ad.paymentStatus !== 'Paid') {
        await releaseReservedFreeBannerCredit({
          creditId: ad.appliedFreeBannerCreditId,
          adRequestId: ad._id
        });
        ad.appliedFreeBannerCreditId = null;
        ad.hasFreeBannerCreditApplied = false;
        ad.freeBannerDiscountAmount = 0;
        ad.billingMessage = null;
        ad.totalCost = ad.originalTotalCost || ad.totalCost;
      }

      ad.status = 'Rejected';
      ad.rejectionReason = 'Approval window expired';
      await ad.save();
    }
    const ads = await AdRequest.find().populate('restaurant', 'name').populate('targetZones', 'name').sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      data: ads.map((ad) => ({
        ...ad,
        ...buildAdBillingSummary(ad)
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all ad requests for the authenticated restaurant
 */
export const getMyAdRequests = async (req, res) => {
  try {
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    if (!restaurantId) {
      return res.status(401).json({
        success: false,
        message: 'Restaurant authentication required'
      });
    }
    const [ads, availableFreeBannerCredits] = await Promise.all([
      AdRequest.find({ restaurant: restaurantId }).populate('targetZones', 'name').sort({ createdAt: -1 }).lean(),
      countAvailableFreeBannerCredits(restaurantId)
    ]);
    res.status(200).json({
      success: true,
      data: ads.map((ad) => ({
        ...ad,
        ...buildAdBillingSummary(ad)
      })),
      availableFreeBannerCredits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single ad request by ID (with ownership check)
 */
export const getAdRequestById = async (req, res) => {
  try {
    const {
      adId
    } = req.params;
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    const isAdmin = !!req.admin;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    const ad = await AdRequest.findById(adId).populate('restaurant', 'name logo').populate('targetZones', 'name');
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }

    // Check ownership if not admin
    if (!isAdmin) {
      const adRestaurantId = ad.restaurant?._id || ad.restaurant;
      if (adRestaurantId.toString() !== restaurantId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access'
        });
      }
    }
    const availableFreeBannerCredits = isAdmin ? 0 : await countAvailableFreeBannerCredits(restaurantId);
    res.status(200).json({
      success: true,
      data: {
        ...ad.toObject(),
        ...buildAdBillingSummary(ad),
        availableFreeBannerCredits
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Restaurant updates a pending ad request
 */
export const updateAdRequest = async (req, res) => {
  try {
    const {
      adId
    } = req.params;
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    const ad = await AdRequest.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }

    // Ownership check
    if (ad.restaurant.toString() !== restaurantId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Only allow editing pending ads
    if (ad.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot edit an ad with status "${ad.status}". Only pending ads can be edited.`
      });
    }
    const {
      title,
      description,
      startDate,
      endDate,
      redirectTarget
    } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate dates
    if (startDate) {
      const parsedStart = parseCampaignDate(startDate);
      if (!parsedStart) {
        return res.status(400).json({
          success: false,
          message: 'Invalid start date format.'
        });
      }
      const start = parsedStart ? normalizeToDayStart(parsedStart) : null;
      if (start < today) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be in the past.'
        });
      }
    }
    if (endDate && startDate) {
      const parsedStart = parseCampaignDate(startDate);
      const parsedEnd = parseCampaignDate(endDate);
      if (!parsedEnd || !parsedStart) {
        return res.status(400).json({
          success: false,
          message: 'Invalid campaign date range.'
        });
      }
      const start = parsedStart ? normalizeToDayStart(parsedStart) : null;
      const end = parsedEnd ? normalizeToDayEnd(parsedEnd) : null;
      if (end < start) {
        return res.status(400).json({
          success: false,
          message: 'End date cannot be before start date.'
        });
      }
    }

    // Apply updates
    if (title) ad.title = title;
    if (description !== undefined) ad.description = description;
    if (startDate) {
      const parsedStart = parseCampaignDate(startDate);
      if (parsedStart) ad.startDate = normalizeToDayStart(parsedStart);
    }
    if (endDate) {
      const parsedEnd = parseCampaignDate(endDate);
      if (parsedEnd) ad.endDate = normalizeToDayEnd(parsedEnd);
    }
    if (redirectTarget) ad.redirectTarget = redirectTarget;

    // Handle new banner upload
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, {
        folder: 'ads/banners',
        resource_type: 'image'
      });
      ad.bannerImage = uploaded.secure_url;
    }
    await ad.save();
    res.status(200).json({
      success: true,
      message: 'Ad updated successfully',
      data: {
        ...ad.toObject(),
        ...buildAdBillingSummary(ad)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete an ad request (Admin only)
 */
/**
 * Admin uploads a banner for a paid ad and activates it
 */
export const uploadAdminBanner = async (req, res) => {
  try {
    const {
      adId
    } = req.params;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required'
      });
    }
    const ad = await AdRequest.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }
    if (ad.paymentStatus !== 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment must be confirmed before uploading banner'
      });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      folder: 'marketing/banners',
      resource_type: 'image'
    });
    ad.bannerImage = uploadResult.secure_url;

    // Determine status based on start date
    const today = new Date();
    const start = new Date(ad.startDate);
    const todayZero = new Date(today.setHours(0, 0, 0, 0));
    const startZero = new Date(start.setHours(0, 0, 0, 0));
    if (startZero <= todayZero) {
      ad.status = 'Active';
    } else {
      ad.status = 'Scheduled';
    }
    await ad.save();
    res.status(200).json({
      success: true,
      message: 'Banner uploaded and ad activated!',
      data: ad
    });
  } catch (error) {
    console.error('Error in uploadAdminBanner:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const deleteAdRequest = async (req, res) => {
  try {
    const {
      adId
    } = req.params;
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    const isAdmin = req.admin && (req.admin.role === 'admin' || req.admin.email);
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid advertisement ID format'
      });
    }
    const ad = await AdRequest.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }

    if (!isAdmin && restaurantId && String(ad.restaurant) !== String(restaurantId)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    if (ad.appliedFreeBannerCreditId && ad.paymentStatus !== 'Paid') {
      await releaseReservedFreeBannerCredit({
        creditId: ad.appliedFreeBannerCreditId,
        adRequestId: ad._id
      });
    }

    await AdRequest.findByIdAndDelete(adId);
    res.status(200).json({
      success: true,
      message: 'Ad request deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
