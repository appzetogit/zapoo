import Delivery from '../models/Delivery.js';
import DeviceToken from '../../notification/models/DeviceToken.js';
import otpService from '../../auth/services/otpService.js';
import jwtService from '../../auth/services/jwtService.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import winston from 'winston';
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

const buildPhoneLookupVariants = (rawPhone) => {
  const value = String(rawPhone || '').trim();
  if (!value) return [];

  const digits = value.replace(/\D/g, '');
  const variants = new Set([value, value.replace(/\s+/g, '')]);

  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }

  // India-specific normalization (frontend primarily uses +91)
  if (digits.length === 10) {
    variants.add(`+91${digits}`);
    variants.add(`91${digits}`);
    variants.add(`+91 ${digits}`);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    const local10 = digits.slice(2);
    variants.add(local10);
    variants.add(`+${digits}`);
    variants.add(`+91${local10}`);
    variants.add(`+91 ${local10}`);
    variants.add(`91${local10}`);
  } else if (digits.length > 10 && digits.startsWith('0')) {
    variants.add(digits.replace(/^0+/, ''));
  }

  return Array.from(variants).filter(Boolean);
};

const findDeliveryByPhone = async (phone) => {
  const variants = buildPhoneLookupVariants(phone);
  if (!variants.length) return null;
  return Delivery.findOne({ phone: { $in: variants } });
};

const getSignupStatus = delivery => {
  const hasBasicDetails = Boolean(
    delivery?.name?.trim() &&
    delivery?.location?.addressLine1?.trim() &&
    delivery?.location?.city?.trim() &&
    delivery?.location?.state?.trim() &&
    delivery?.vehicle?.type &&
    delivery?.vehicle?.number?.trim() &&
    delivery?.documents?.pan?.number?.trim() &&
    delivery?.documents?.aadhar?.number?.trim()
  );

  if (!hasBasicDetails) {
    return { needsSignup: true, signupStep: 'details' };
  }

  const hasAllDocuments = Boolean(
    delivery?.profileImage?.url &&
    delivery?.documents?.aadhar?.document &&
    delivery?.documents?.pan?.document &&
    delivery?.documents?.drivingLicense?.document
  );

  if (!hasAllDocuments) {
    return { needsSignup: true, signupStep: 'documents' };
  }

  return { needsSignup: false, signupStep: null };
};

const buildResumeSignupData = delivery => ({
  details: {
    name: delivery?.name || "",
    phone: String(delivery?.phone || "").replace(/\D/g, "").slice(-10),
    countryCode: "+91",
    ref: "",
    email: delivery?.email || "",
    address: delivery?.location?.addressLine1 || "",
    city: delivery?.location?.city || "",
    state: delivery?.location?.state || "",
    vehicleType: delivery?.vehicle?.type || "bike",
    vehicleName: delivery?.vehicle?.model || delivery?.vehicle?.brand || "",
    vehicleNumber: delivery?.vehicle?.number || "",
    drivingLicenseNumber: delivery?.documents?.drivingLicense?.number || "",
    panNumber: delivery?.documents?.pan?.number || "",
    aadharNumber: delivery?.documents?.aadhar?.number || ""
  },
  documents: {
    profilePhoto: delivery?.profileImage?.url ? {
      url: delivery.profileImage.url,
      publicId: delivery.profileImage.publicId || null
    } : null,
    aadharPhoto: delivery?.documents?.aadhar?.document ? {
      url: delivery.documents.aadhar.document,
      publicId: null
    } : null,
    panPhoto: delivery?.documents?.pan?.document ? {
      url: delivery.documents.pan.document,
      publicId: null
    } : null,
    drivingLicensePhoto: delivery?.documents?.drivingLicense?.document ? {
      url: delivery.documents.drivingLicense.document,
      publicId: null
    } : null
  }
});

/**
 * Send OTP for delivery boy phone number
 * POST /api/delivery/auth/send-otp
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const {
    phone,
    purpose = 'login'
  } = req.body;

  // Validate phone number
  if (!phone) {
    return errorResponse(res, 400, 'Phone number is required');
  }

  // Validate phone number format
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  if (!phoneRegex.test(phone)) {
    return errorResponse(res, 400, 'Invalid phone number format');
  }
  try {
    const result = await otpService.generateAndSendOTP(phone, purpose, null);
    return successResponse(res, 200, result.message, {
      expiresIn: result.expiresIn,
      identifierType: result.identifierType
    });
  } catch (error) {
    logger.error(`Error sending OTP: ${error.message}`);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * Verify OTP and login/register delivery boy
 * POST /api/delivery/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const {
    phone,
    otp,
    purpose = 'login',
    name,
    fcmToken,
    platform = 'web'
  } = req.body;

  // Validate inputs
  if (!phone || !otp) {
    return errorResponse(res, 400, 'Phone number and OTP are required');
  }

  // Normalize name - convert null/undefined to empty string for optional field
  const normalizedName = name && typeof name === 'string' ? name.trim() : null;
  const normalizedFcmToken = fcmToken && typeof fcmToken === 'string' ? fcmToken.trim() : null;
  const normalizedPlatform = String(platform || 'web').toLowerCase();
  try {
    let delivery;
    let isExistingDeliveryLogin = false;
    const identifier = phone;
    if (purpose === 'register') {
      // Registration flow
      // Check if delivery boy already exists
      delivery = await findDeliveryByPhone(phone);
      if (delivery) {
        return errorResponse(res, 400, 'Delivery boy already exists with this phone number. Please login.');
      }

      // Name is mandatory for explicit registration
      if (!normalizedName) {
        return errorResponse(res, 400, 'Name is required for registration');
      }

      // Verify OTP before creating delivery boy
      await otpService.verifyOTP(phone, otp, purpose, null);
      const deliveryData = {
        name: normalizedName,
        phone,
        phoneVerified: true,
        signupMethod: 'phone',
        status: 'pending',
        // New delivery boys start as pending approval
        isActive: true // Allow login to see verification message
      };
      try {
        delivery = await Delivery.create(deliveryData);
      } catch (createError) {
        // Handle duplicate key error
        if (createError.code === 11000) {
          delivery = await Delivery.findOne({
            phone
          });
          if (!delivery) {
            throw createError;
          }
          return errorResponse(res, 400, 'Delivery boy already exists with this phone number. Please login.');
        } else {
          throw createError;
        }
      }
    } else {
      // Login (with optional auto-registration)
      delivery = await findDeliveryByPhone(phone);
      isExistingDeliveryLogin = Boolean(delivery);

      // Verify OTP first (before creating user)
      await otpService.verifyOTP(phone, otp, purpose, null);
      if (!delivery) {
        // New user - create minimal record for signup flow
        // Use provided name or placeholder
        const deliveryData = {
          name: normalizedName || 'Delivery Partner',
          // Placeholder if not provided
          phone,
          phoneVerified: true,
          signupMethod: 'phone',
          status: 'pending',
          // New delivery boys start as pending approval
          isActive: true // Allow login to see verification message
        };
        try {
          delivery = await Delivery.create(deliveryData);
        } catch (createError) {
          if (createError.code === 11000) {
            delivery = await findDeliveryByPhone(phone);
            if (!delivery) {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      } else {
        // Existing delivery boy login - update verification status if needed
        if (!delivery.phoneVerified) {
          delivery.phoneVerified = true;
          await delivery.save();
        }
      }

    }

    const signupStatus = getSignupStatus(delivery);
    const isRejectedAccount = delivery.status === 'blocked';

    // Save FCM token if provided
    if (normalizedFcmToken) {
      const isMobile = ['mobile', 'android', 'ios', 'app'].includes(normalizedPlatform);
      const targetArray = isMobile ? 'fcmTokenMobile' : 'fcmTokenWeb';

      if (!delivery[targetArray]) delivery[targetArray] = [];
      if (!delivery[targetArray].includes(normalizedFcmToken)) {
        delivery[targetArray].push(normalizedFcmToken);
      }
      if (delivery[targetArray].length > 10) delivery[targetArray] = delivery[targetArray].slice(-10);

      console.log(`[DeliveryAuth] FCM Token Updated (${isMobile ? 'Mobile' : 'Web'})`);
    } else {
      console.warn(`[DeliveryAuth] No FCM token provided in OTP verification. Phone: ${phone}, Platform: ${normalizedPlatform}`);
    }

    if (isRejectedAccount) {
      const tokens = jwtService.generateTokens({
        userId: delivery._id.toString(),
        role: 'delivery',
        email: delivery.email || delivery.phone || delivery.deliveryId
      });

      delivery.refreshToken = tokens.refreshToken;
      await delivery.save();

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return successResponse(res, 200, 'OTP verified. Please update and resubmit your profile.', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: delivery._id,
          name: delivery.name,
          phone: delivery.phone,
          email: delivery.email,
          deliveryId: delivery.deliveryId,
          status: delivery.status,
          rejectionReason: delivery.rejectionReason || null
        },
        needsSignup: true,
        signupStep: signupStatus.signupStep || 'details',
        resumeRejectedOnboarding: true,
        resumeSignupData: buildResumeSignupData(delivery)
      });
    }

    // Existing registered delivery partners should not be forced back into onboarding on login.
    // Keep onboarding flow only for new/registration flows.
    if (signupStatus.needsSignup && !isExistingDeliveryLogin) {
      // Generate tokens for signup flow
      const tokens = jwtService.generateTokens({
        userId: delivery._id.toString(),
        role: 'delivery',
        email: delivery.email || delivery.phone || delivery.deliveryId
      });

      // Store refresh token
      delivery.refreshToken = tokens.refreshToken;
      await delivery.save();

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      return successResponse(res, 200, 'OTP verified. Please complete your profile.', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: delivery._id,
          name: delivery.name,
          phone: delivery.phone,
          email: delivery.email,
          deliveryId: delivery.deliveryId,
          status: delivery.status,
          rejectionReason: delivery.rejectionReason || null // Include rejection reason for blocked accounts
        },
        needsSignup: true,
        signupStep: signupStatus.signupStep
      });
    }

    // Check if delivery boy is active (blocked/pending status partners can still login to see rejection reason or verification message)
    if (!delivery.isActive && delivery.status !== 'blocked' && delivery.status !== 'pending') {
      return errorResponse(res, 403, 'Your account has been deactivated. Please contact support.');
    }

    // Generate tokens
    const tokens = jwtService.generateTokens({
      userId: delivery._id.toString(),
      role: 'delivery',
      email: delivery.email || delivery.phone || delivery.deliveryId
    });

    // Store refresh token in database
    delivery.refreshToken = tokens.refreshToken;
    await delivery.save();

    console.log(`[DeliveryAuth] Login - Tokens saved. DeliveryID: ${delivery.deliveryId}, webCount: ${delivery.fcmTokensWeb?.length || 0}, mobileCount: ${delivery.fcmTokensMobile?.length || 0}`);

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Update last login
    delivery.lastLogin = new Date();
    await delivery.save();

    // Return access token and delivery boy info
    // Load wallet/earnings from DeliveryWallet as source of truth
    let walletData = null;
    try {
      const { default: DeliveryWallet } = await import('../models/DeliveryWallet.js');
      const wallet = await DeliveryWallet.findOne({ deliveryId: delivery._id }).lean();
      if (wallet) {
        walletData = {
          totalEarned: wallet.totalEarned || 0,
          currentBalance: wallet.currentBalance || 0,
          pendingPayout: wallet.pendingPayout || 0,
          tips: wallet.tips || 0,
        };
      }
    } catch (e) {
      walletData = null;
    }

    return successResponse(res, 200, 'Authentication successful', {
      accessToken: tokens.accessToken,
      user: {
        id: delivery._id,
        deliveryId: delivery.deliveryId,
        name: delivery.name,
        email: delivery.email,
        phone: delivery.phone,
        phoneVerified: delivery.phoneVerified,
        signupMethod: delivery.signupMethod,
        profileImage: delivery.profileImage,
        isActive: delivery.isActive,
        status: delivery.status,
        rejectionReason: delivery.rejectionReason || null,
        // Include rejection reason for blocked accounts
        metrics: delivery.metrics,
        earnings: walletData ?? { totalEarned: 0, currentBalance: 0, pendingPayout: 0, tips: 0 },
        preferences: delivery.preferences || { language: 'en' }
      }
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * Refresh Access Token
 * POST /api/delivery/auth/refresh-token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or header
  const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
  if (!refreshToken) {
    return errorResponse(res, 401, 'Refresh token not found');
  }
  try {
    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(refreshToken);

    // Ensure it's a delivery token
    if (decoded.role !== 'delivery') {
      return errorResponse(res, 401, 'Invalid token for delivery');
    }

    // Get delivery boy from database and verify refresh token matches
    const delivery = await Delivery.findById(decoded.userId).select('+refreshToken');
    if (!delivery || !delivery.isActive) {
      return errorResponse(res, 401, 'Delivery boy not found or inactive');
    }

    // Verify refresh token matches stored token
    if (delivery.refreshToken !== refreshToken) {
      return errorResponse(res, 401, 'Invalid refresh token');
    }

    // Generate new access token
    const accessToken = jwtService.generateAccessToken({
      userId: delivery._id.toString(),
      role: 'delivery',
      email: delivery.email || delivery.phone || delivery.deliveryId
    });
    return successResponse(res, 200, 'Token refreshed successfully', {
      accessToken
    });
  } catch (error) {
    return errorResponse(res, 401, error.message || 'Invalid refresh token');
  }
});

/**
 * Logout
 * POST /api/delivery/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Best-effort token cleanup so logout consistently removes FCM tokens from DB.
  try {
    const deliveryId = req.delivery?._id ? String(req.delivery._id) : null;
    if (deliveryId) {
      await Promise.all([
        DeviceToken.deleteMany({ userId: deliveryId, role: 'delivery' }),
        Delivery.findByIdAndUpdate(deliveryId, {
          $set: {
            fcmTokenWeb: [],
            fcmTokenMobile: []
          }
        })
      ]);
    }
  } catch (cleanupErr) {
    logger.warn(`FCM cleanup on delivery logout failed: ${cleanupErr.message}`);
  }

  // Get delivery boy from request (set by auth middleware)
  if (req.delivery) {
    // Clear refresh token from database
    req.delivery.refreshToken = null;
    await req.delivery.save();
  }

  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  return successResponse(res, 200, 'Logged out successfully');
});

/**
 * Get current delivery boy
 * GET /api/delivery/auth/me
 */
export const getCurrentDelivery = asyncHandler(async (req, res) => {
  // Delivery boy is attached by authenticate middleware

  // Load wallet/earnings from DeliveryWallet as source of truth
  let walletData = null;
  try {
    const { default: DeliveryWallet } = await import('../models/DeliveryWallet.js');
    const wallet = await DeliveryWallet.findOne({ deliveryId: req.delivery._id }).lean();
    if (wallet) {
      walletData = {
        totalEarned: wallet.totalEarned || 0,
        currentBalance: wallet.currentBalance || 0,
        pendingPayout: wallet.pendingPayout || 0,
        tips: wallet.tips || 0,
      };
    }
  } catch (e) {
    walletData = null;
  }

  return successResponse(res, 200, 'Delivery boy retrieved successfully', {
    user: {
      id: req.delivery._id,
      deliveryId: req.delivery.deliveryId,
      name: req.delivery.name,
      email: req.delivery.email,
      phone: req.delivery.phone,
      phoneVerified: req.delivery.phoneVerified,
      signupMethod: req.delivery.signupMethod,
      profileImage: req.delivery.profileImage,
      isActive: req.delivery.isActive,
      status: req.delivery.status,
      location: req.delivery.location,
      vehicle: req.delivery.vehicle,
      documents: req.delivery.documents,
      availability: req.delivery.availability,
      metrics: req.delivery.metrics,
      earnings: walletData ?? { totalEarned: 0, currentBalance: 0, pendingPayout: 0, tips: 0 },
      level: req.delivery.level,
      lastLogin: req.delivery.lastLogin,
      preferences: req.delivery.preferences || { language: 'en' }
    }
  });
});

