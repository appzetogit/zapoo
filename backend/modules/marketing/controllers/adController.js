import AdRequest from '../models/AdRequest.js';
import SlotConfiguration from '../models/SlotConfiguration.js';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import Restaurant from '../../restaurant/models/Restaurant.js';

// Pricing configuration based on Tier Rank
const AD_PRICING = {
    1: 300,  // Tier 1
    2: 500,  // Tier 2
    3: 800,  // Tier 3
    4: 1200  // Tier 4
};

const DEFAULT_PRICING = 500;

/**
 * Helper to check slot availability for a date range in specific zones
 */
const checkAvailability = async (zones, startDate, endDate) => {
    const results = [];

    for (const zoneId of zones) {
        const config = await SlotConfiguration.findOne({ zone: zoneId, isActive: true });
        if (!config) {
            results.push({ zoneId, available: false, reason: 'Zone not configured for ads' });
            continue;
        }

        // Find overlapping approved/active campaigns
        const overlappingAds = await AdRequest.find({
            targetZones: zoneId,
            status: { $in: ['Approved', 'Scheduled', 'Active'] },
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
            ]
        });

        // Check availability for each day in range
        let isFull = false;
        let curr = new Date(startDate);
        const end = new Date(endDate);

        while (curr <= end) {
            const countForDay = overlappingAds.filter(ad =>
                ad.startDate <= curr && ad.endDate >= curr
            ).length;

            if (countForDay >= config.maxSlots) {
                isFull = true;
                break;
            }
            curr.setDate(curr.getDate() + 1);
        }

        results.push({
            zoneId,
            available: !isFull,
            slotsUsed: overlappingAds.length,
            maxSlots: config.maxSlots
        });
    }

    return results;
};

import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';

/**
 * Restaurant submits an ad request
 */
export const createAdRequest = async (req, res) => {
    try {
        const {
            targetZones,
            startDate,
            endDate,
            title,
            description,
            redirectTarget
        } = req.body;

        const restaurantId = req.restaurant?._id || req.restaurant?.id;

        if (!restaurantId) {
            return res.status(401).json({ success: false, message: 'Restaurant authentication required' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Banner image is required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (days <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid date range' });
        }

        // 1. Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file.buffer, {
            folder: 'marketing/banners',
            resource_type: 'image'
        });

        // 2. Check availability
        const availability = await checkAvailability(targetZones, start, end);
        const unavailableZones = availability.filter(a => !a.available);

        if (unavailableZones.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Slots are full for some selected zones/dates',
                unavailableZones
            });
        }

        // 3. Calculate total cost based on Tier
        let totalCost = 0;
        for (const zoneId of targetZones) {
            const zone = await Zone.findById(zoneId).populate('tierId');
            const tierRank = zone?.tierId?.rank || 2;
            const pricePerDay = AD_PRICING[tierRank] || DEFAULT_PRICING;
            totalCost += pricePerDay * days;
        }

        const adRequest = await AdRequest.create({
            restaurant: restaurantId,
            bannerImage: uploadResult.secure_url,
            targetZones,
            startDate: start,
            endDate: end,
            title,
            description,
            redirectTarget,
            totalCost,
            status: 'Pending'
        });

        res.status(201).json({
            success: true,
            data: adRequest,
            message: 'Advertisement request submitted for review'
        });

    } catch (error) {
        console.error('Error in createAdRequest:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin approves or rejects ad request
 */
export const updateAdStatus = async (req, res) => {
    try {
        const { adId } = req.params;
        const { status, rejectionReason } = req.body;

        const ad = await AdRequest.findById(adId);
        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad request not found' });
        }

        if (status === 'Approved') {
            // Re-verify availability at time of approval
            const availability = await checkAvailability(ad.targetZones, ad.startDate, ad.endDate);
            const unavailableZones = availability.filter(a => !a.available);

            if (unavailableZones.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Slots became full during the pending period. Cannot approve.',
                    unavailableZones
                });
            }

            ad.status = 'Approved';
            ad.paymentStatus = 'Paid'; // Assuming payment is handled or confirmed
            ad.approvedBy = req.user?._id;
            ad.approvalDate = new Date();
        } else if (status === 'Rejected') {
            ad.status = 'Rejected';
            ad.rejectionReason = rejectionReason;
        } else {
            ad.status = status;
        }

        await ad.save();

        res.status(200).json({
            success: true,
            data: ad,
            message: `Ad status updated to ${status}`
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get active ads for user display by zone
 */
export const getActiveAdsByZone = async (req, res) => {
    try {
        const { zoneId } = req.params;
        const now = new Date();

        // Fetch up to 5 active ads (as placeholder rotate)
        const ads = await AdRequest.find({
            targetZones: zoneId,
            status: 'Active',
            startDate: { $lte: now },
            endDate: { $gte: now }
        })
            .limit(3) // per business rule: display only a limited number
            .populate('restaurant', 'name logo');

        res.status(200).json({ success: true, data: ads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Tracking metrics
 */
export const trackAdMetric = async (req, res) => {
    try {
        const { adId } = req.params;
        const { type } = req.body; // 'impression', 'click', 'order'

        const updateMap = {
            'impression': 'metrics.impressions',
            'click': 'metrics.clicks',
            'order': 'metrics.orders'
        };

        if (!updateMap[type]) {
            return res.status(400).json({ success: false, message: 'Invalid metric type' });
        }

        const ad = await AdRequest.findByIdAndUpdate(
            adId,
            { $inc: { [updateMap[type]]: 1 } },
            { new: true }
        );

        res.status(200).json({ success: true, data: ad.metrics });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
            return res.status(401).json({ success: false, message: 'Restaurant authentication required' });
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

            const activeZones = await Zone.find({ isActive: true });
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
            await Restaurant.findByIdAndUpdate(restaurant._id, { $set: { zoneId: detectedZone._id } });
            console.log(`✅ [getMyZone] Auto-healed zoneId for restaurant ${restaurant._id} → zone ${detectedZone.name}`);

            zoneId = detectedZone._id;
        }
        // ─────────────────────────────────────────────────────────────────────

        const zone = await Zone.findById(zoneId).populate('tierId', 'name rank');

        if (!zone || !zone.isActive) {
            return res.status(404).json({ success: false, message: 'Your zone is not currently available for advertising.' });
        }

        const tierRank = zone.tierId?.rank || 2;
        const zoneData = {
            _id: zone._id,
            name: zone.name || zone.zoneName,
            tier: zone.tierId?.name || 'Standard',
            pricePerDay: AD_PRICING[tierRank] || DEFAULT_PRICING
        };

        res.status(200).json({ success: true, data: zoneData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * Get all ad requests (for admin)
 */
export const getAllAdRequests = async (req, res) => {
    try {
        const ads = await AdRequest.find()
            .populate('restaurant', 'name')
            .populate('targetZones', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: ads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all ad requests for the authenticated restaurant
 */
export const getMyAdRequests = async (req, res) => {
    try {
        const restaurantId = req.restaurant?._id || req.restaurant?.id;
        if (!restaurantId) {
            return res.status(401).json({ success: false, message: 'Restaurant authentication required' });
        }

        const ads = await AdRequest.find({ restaurant: restaurantId })
            .populate('targetZones', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: ads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single ad request by ID (with ownership check)
 */
export const getAdRequestById = async (req, res) => {
    try {
        const { adId } = req.params;
        const restaurantId = req.restaurant?._id || req.restaurant?.id;
        const isAdmin = !!req.admin;

        const ad = await AdRequest.findById(adId)
            .populate('restaurant', 'name logo')
            .populate('targetZones', 'name');

        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad request not found' });
        }

        // Check ownership if not admin
        if (!isAdmin && ad.restaurant.toString() !== restaurantId?.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized access' });
        }

        res.status(200).json({ success: true, data: ad });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Restaurant updates a pending ad request
 */
export const updateAdRequest = async (req, res) => {
    try {
        const { adId } = req.params;
        const restaurantId = req.restaurant?._id || req.restaurant?.id;

        const ad = await AdRequest.findById(adId);
        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad request not found' });
        }

        // Ownership check
        if (ad.restaurant.toString() !== restaurantId?.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized access' });
        }

        // Only allow editing pending ads
        if (ad.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot edit an ad with status "${ad.status}". Only pending ads can be edited.`
            });
        }

        const { title, description, startDate, endDate, redirectTarget } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Validate dates
        if (startDate) {
            const start = new Date(startDate);
            if (start < today) {
                return res.status(400).json({ success: false, message: 'Start date cannot be in the past.' });
            }
        }
        if (endDate && startDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (end < start) {
                return res.status(400).json({ success: false, message: 'End date cannot be before start date.' });
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
                resource_type: 'image',
            });
            ad.bannerImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
        }

        await ad.save();

        res.status(200).json({ success: true, message: 'Ad updated successfully', data: ad });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
