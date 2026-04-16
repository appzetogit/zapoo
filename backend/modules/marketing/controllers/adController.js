import mongoose from 'mongoose';
import AdRequest from '../models/AdRequest.js';
import ChallengeBanner from '../models/ChallengeBanner.js';
import { createOrder, verifyPayment } from '../../payment/services/razorpayService.js';
import express from 'express';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
import { calculateDistance } from '../../order/services/orderCalculationService.js';
import {
  countAvailableFreeBannerCredits,
  reserveOldestAvailableFreeBannerCredit,
  markReservedCreditAsConsumed,
  releaseReservedFreeBannerCredit
} from '../services/freeBannerCreditService.js';

// Pricing configuration based on Tier Rank
const AD_PRICING = {
  1: 300,
  // Tier 1
  2: 500,
  // Tier 2
  3: 800,
  // Tier 3
  4: 1200 // Tier 4
};
const DEFAULT_PRICING = 500;

// NOTE: Slot-based capacity (max banners per tier/zone) has been removed.
// Ads are no longer limited by per-day slot counts; only dates and status
// determine eligibility.
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';

const FREE_BANNER_MESSAGE = 'You have won a free day banner';

const buildAdBillingSummary = (ad = {}) => ({
  originalTotalCost: Number(ad.originalTotalCost ?? ad.totalCost ?? 0),
  freeBannerDiscountAmount: Number(ad.freeBannerDiscountAmount || 0),
  finalTotalCost: Number(ad.totalCost || 0),
  hasFreeBannerCreditApplied: Boolean(ad.hasFreeBannerCreditApplied),
  appliedFreeBannerCreditId: ad.appliedFreeBannerCreditId || null,
  billingMessage: ad.billingMessage || null
});

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

    const tierRank = zone?.tierId?.rank || 2;
    const pricePerDay = AD_PRICING[tierRank] || DEFAULT_PRICING;
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
    // DEBUG: Log what we receive

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
      return res.status(400).json({
        success: false,
        message: 'At least one target zone must be selected'
      });
    }
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    if (!restaurantId) {
      console.error('❌ [createAdRequest] Missing restaurantId');
      return res.status(401).json({
        success: false,
        message: 'Restaurant authentication required'
      });
    }

    // Convert targetZones to ObjectIds for reliable querying
    const targetZoneIds = targetZones.map(id => new mongoose.Types.ObjectId(id));
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start or end date'
      });
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    if (normalizedStart <= today) {
      return res.status(400).json({
        success: false,
        message: 'Campaigns must be requested at least one day in advance.'
      });
    }
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (isNaN(days) || days <= 0) {
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
      rejectionReason
    } = req.body;
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
    if (status === 'Approved') {
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
      ad.approvedBy = req.user?._id;
      ad.approvalDate = new Date();
    } else if (status === 'Rejected') {
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
    } else {
      ad.status = status;
    }
    await ad.save();
    res.status(200).json({
      success: true,
      data: {
        ...ad.toObject(),
        ...buildAdBillingSummary(ad)
      },
      message: `Ad status updated to ${status}`
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
    const now = new Date();

    const [paidAds, challengeBanners] = await Promise.all([
      AdRequest.find({
        targetZones: zoneId,
        status: { $in: ['Active', 'Scheduled'] },
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
        .populate('restaurant', 'name logo address location deliveryRange')
        .limit(20)
        .lean(),
      ChallengeBanner.find({
        zoneId,
        startDate: { $lte: now },
        endDate: { $gte: now }
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

      const nearbyRestaurants = await Restaurant.find({
        isActive: true,
        'location.coordinates': {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [userLng, userLat] },
            $maxDistance: maxRangeMeters
          }
        }
      }).select('_id deliveryRange location').lean();

      const inRangeRestIds = nearbyRestaurants
        .filter(r => {
          const rLat = r.location?.latitude ?? r.location?.coordinates?.[1];
          const rLng = r.location?.longitude ?? r.location?.coordinates?.[0];
          if (rLat == null || rLng == null) return false;
          return calculateDistance([rLng, rLat], [userLng, userLat]) <= (r.deliveryRange ?? 5);
        })
        .map(r => r._id);

      if (inRangeRestIds.length > 0) {
        const [extraPaidAds, extraChallengeBanners] = await Promise.all([
          AdRequest.find({
            restaurant: { $in: inRangeRestIds },
            status: { $in: ['Active', 'Scheduled'] },
            startDate: { $lte: now },
            endDate: { $gte: now }
          })
            .populate('restaurant', 'name logo address location deliveryRange')
            .limit(20)
            .lean(),
          ChallengeBanner.find({
            restaurant: { $in: inRangeRestIds },
            startDate: { $lte: now },
            endDate: { $gte: now }
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

    const now = new Date();

    const settings = await BusinessSettings.getSettings();
    const maxRangeMeters = (settings.maxDeliveryRange || 20) * 1000;

    const nearbyRestaurants = await Restaurant.find({
      isActive: true,
      'location.coordinates': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [userLng, userLat] },
          $maxDistance: maxRangeMeters
        }
      }
    }).select('_id deliveryRange location').lean();

    const inRangeRestIds = nearbyRestaurants
      .filter(r => {
        const rLat = r.location?.latitude ?? r.location?.coordinates?.[1];
        const rLng = r.location?.longitude ?? r.location?.coordinates?.[0];
        if (rLat == null || rLng == null) return false;
        return calculateDistance([rLng, rLat], [userLng, userLat]) <= (r.deliveryRange ?? 5);
      })
      .map(r => r._id);

    if (inRangeRestIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [paidAds, challengeBanners] = await Promise.all([
      AdRequest.find({
        restaurant: { $in: inRangeRestIds },
        status: { $in: ['Active', 'Scheduled'] },
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
        .populate('restaurant', 'name logo address location deliveryRange')
        .limit(20)
        .lean(),
      ChallengeBanner.find({
        restaurant: { $in: inRangeRestIds },
        startDate: { $lte: now },
        endDate: { $gte: now }
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
    if (!mongoose.Types.ObjectId.isValid(adId)) {
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
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }
    if (ad.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Ad must be Approved before payment'
      });
    }
    if (ad.paymentStatus === 'Paid') {
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
    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_API_KEY
      }
    });
  } catch (error) {
    console.error('Error creating ad payment order:', error);
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
    const {
      adId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;
    const restaurantId = req.restaurant?._id || req.restaurant?.id;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
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
      return res.status(404).json({
        success: false,
        message: 'Ad request not found'
      });
    }
    if (!ad.razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: 'No payment order found for this ad'
      });
    }
    const isValid = await verifyPayment(ad.razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    ad.paymentStatus = 'Paid';
    ad.razorpayPaymentId = razorpayPaymentId;
    ad.razorpaySignature = razorpaySignature;
    ad.status = 'Banner Pending';
    await ad.save();

    if (ad.appliedFreeBannerCreditId) {
      await markReservedCreditAsConsumed({
        creditId: ad.appliedFreeBannerCreditId,
        adRequestId: ad._id
      });
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

    const zone = await Zone.findById(zoneId).populate('tierId', 'name rank');
    if (!zone || !zone.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Your zone is not currently available for advertising.'
      });
    }
    const tierRank = zone.tierId?.rank || 2;
    const zoneData = {
      _id: zone._id,
      name: zone.name || zone.zoneName,
      tier: zone.tierId?.name || 'Standard',
      pricePerDay: AD_PRICING[tierRank] || DEFAULT_PRICING
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
      const start = new Date(startDate);
      if (start < today) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be in the past.'
        });
      }
    }
    if (endDate && startDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
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
    if (startDate) ad.startDate = new Date(startDate);
    if (endDate) ad.endDate = new Date(endDate);
    if (redirectTarget) ad.redirectTarget = redirectTarget;

    // Handle new banner upload
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, {
        folder: 'ads/banners',
        resource_type: 'image'
      });
      ad.bannerImage = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id
      };
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
