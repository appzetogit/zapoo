import Restaurant from '../models/Restaurant.js';
import SubscriptionPlan from '../../admin/models/SubscriptionPlan.js';
import Zone from '../../admin/models/Zone.js';
import Tier from '../../admin/models/Tier.js';
import otpService from '../../auth/services/otpService.js';
import jwtService from '../../auth/services/jwtService.js';
import firebaseAuthService from '../../auth/services/firebaseAuthService.js';
import googleAuthService from '../../auth/services/googleAuthService.js';
import DeviceToken from '../../notification/models/DeviceToken.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { normalizePhoneNumber } from '../../../shared/utils/phoneUtils.js';
import winston from 'winston';

/**
 * Build phone query that searches in multiple formats (with/without country code)
 * This handles both old data (without country code) and new data (with country code)
 */
const buildPhoneQuery = normalizedPhone => {
  if (!normalizedPhone) return null;

  // Check if normalized phone has country code (starts with 91 and is 12 digits)
  if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
    // Search for both: with country code (917610416911) and without (7610416911)
    const phoneWithoutCountryCode = normalizedPhone.substring(2);
    return {
      $or: [{
        phone: normalizedPhone
      }, {
        phone: phoneWithoutCountryCode
      }, {
        phone: `+${normalizedPhone}`
      }, {
        phone: `+91${phoneWithoutCountryCode}`
      }]
    };
  } else {
    // If it's already without country code, also check with country code
    return {
      $or: [{
        phone: normalizedPhone
      }, {
        phone: `91${normalizedPhone}`
      }, {
        phone: `+91${normalizedPhone}`
      }, {
        phone: `+${normalizedPhone}`
      }]
    };
  }
};
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

const isAbandonedIncompleteRestaurant = restaurant => {
  if (!restaurant) return false;
  const completedSteps = Number(restaurant?.onboarding?.completedSteps || 0);
  // Incomplete onboarding draft that never reached submit-complete state.
  return restaurant.isActive === false && completedSteps < 3;
};

/**
 * Send OTP for restaurant phone number or email
 * POST /api/restaurant/auth/send-otp
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const {
    phone,
    email,
    purpose = 'login'
  } = req.body;

  // Validate that either phone or email is provided
  if (!phone && !email) {
    return errorResponse(res, 400, 'Either phone number or email is required');
  }

  // Validate phone number format if provided
  if (phone) {
    const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return errorResponse(res, 400, 'Invalid phone number format. Please provide a valid 10-digit Indian mobile number.');
    }
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 400, 'Invalid email format');
    }
  }
  console.log(`[RestaurantAuth] sendOTP:`, { purpose, hasPhone: !!phone, hasEmail: !!email });
  try {
    const result = await otpService.generateAndSendOTP(phone || null, purpose, email || null);
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
 * Verify OTP and login/register restaurant
 * POST /api/restaurant/auth/verify-otp
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const {
    phone,
    email,
    otp,
    purpose = 'login',
    name,
    password
  } = req.body;

  // Validate that either phone or email is provided
  if (!phone && !email || !otp) {
    return errorResponse(res, 400, 'Either phone number or email, and OTP are required');
  }
  console.log(`[RestaurantAuth] verifyOTP:`, { purpose, hasPhone: !!phone, hasEmail: !!email });
  try {
    let restaurant;
    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    if (phone && !normalizedPhone) {
      return errorResponse(res, 400, 'Invalid phone number format');
    }
    const identifier = normalizedPhone || email;
    const identifierType = normalizedPhone ? 'phone' : 'email';
    if (purpose === 'register') {
      // Registration flow
      // Check if restaurant already exists with normalized phone
      // For phone, search in both formats (with and without country code) to handle old data
      const findQuery = normalizedPhone ? buildPhoneQuery(normalizedPhone) : {
        email: email?.toLowerCase().trim()
      };
      restaurant = await Restaurant.findOne(findQuery);
      if (isAbandonedIncompleteRestaurant(restaurant)) {
        await Restaurant.deleteOne({
          _id: restaurant._id
        });
        restaurant = null;
      }
      if (restaurant) {
        return errorResponse(res, 400, `Restaurant already exists with this ${identifierType}. Please login.`);
      }

      // Name is mandatory for explicit registration
      if (!name) {
        return errorResponse(res, 400, 'Restaurant name is required for registration');
      }

      // Verify OTP (pass normalized phone for consistency with storage)
      await otpService.verifyOTP(normalizedPhone || phone || null, otp, purpose, email || null);
      const restaurantData = {
        name,
        signupMethod: normalizedPhone ? 'phone' : 'email'
      };
      if (normalizedPhone) {
        restaurantData.phone = normalizedPhone;
        restaurantData.phoneVerified = true;
        restaurantData.ownerPhone = normalizedPhone;
        // For phone signup, set ownerEmail to empty string or phone-based email
        restaurantData.ownerEmail = email || `${normalizedPhone}@restaurant.appzeto.com`;
        // CRITICAL: Do NOT set email field for phone signups to avoid null duplicate key error
        // Email field should be completely omitted, not set to null or undefined
      }
      if (email) {
        restaurantData.email = email.toLowerCase().trim();
        restaurantData.ownerEmail = email.toLowerCase().trim();
      }
      // Ensure email is not set to null or undefined
      if (!email && !phone) {
        // This shouldn't happen due to validation, but just in case
        throw new Error('Either phone or email must be provided');
      }

      // If password provided (email/password registration), set it
      if (password && !phone) {
        restaurantData.password = password;
      }

      // Set owner name from restaurant name if not provided separately
      restaurantData.ownerName = name;

      // Set isActive to false - restaurant needs admin approval before becoming active
      restaurantData.isActive = false;
      try {
        if (phone && !email) {
          const docToInsert = { ...restaurantData };
          delete docToInsert.email;
          restaurant = await Restaurant.create(docToInsert);
        } else {
          restaurant = await Restaurant.create(restaurantData);
        }
      } catch (createError) {
        logger.error(`Error creating restaurant: ${createError.message}`, {
          code: createError.code,
          keyPattern: createError.keyPattern,
          phone,
          email,
          restaurantData: {
            ...restaurantData,
            password: '***'
          }
        });

        // Handle duplicate key error (email, phone, or slug)
        if (createError.code === 11000) {
          // Check if it's an email null duplicate key error (common with phone signups)
          if (createError.keyPattern && createError.keyPattern.email && phone && !email) {
            logger.warn(`Email null duplicate key error for phone signup: ${phone}`, {
              error: createError.message,
              keyPattern: createError.keyPattern
            });
            // Try to find existing restaurant by phone (using buildPhoneQuery for multiple formats)
            const findExistingQuery = buildPhoneQuery(normalizedPhone) || { phone: normalizedPhone || phone };
            restaurant = await Restaurant.findOne(findExistingQuery);
            if (restaurant) {
              return errorResponse(res, 400, `Restaurant already exists with this phone number. Please login.`);
            }
            // If not found, this is likely a database index issue - ensure email is completely removed
            // Create a fresh restaurantData object without email field
            const retryRestaurantData = {
              name: restaurantData.name,
              signupMethod: restaurantData.signupMethod,
              phone: restaurantData.phone,
              phoneVerified: restaurantData.phoneVerified,
              ownerPhone: restaurantData.ownerPhone,
              ownerEmail: restaurantData.ownerEmail,
              ownerName: restaurantData.ownerName,
              isActive: restaurantData.isActive
            };
            // Explicitly do NOT include email field
            if (restaurantData.password) {
              retryRestaurantData.password = restaurantData.password;
            }
            try {
              restaurant = await Restaurant.create(retryRestaurantData);
            } catch (retryError) {
              logger.error(`Failed to create restaurant after email null fix: ${retryError.message}`, {
                code: retryError.code,
                keyPattern: retryError.keyPattern,
                error: retryError
              });
              // Check if it's still a duplicate key error
              if (retryError.code === 11000) {
                // Try to find restaurant again (search in both formats)
                const phoneQuery = buildPhoneQuery(normalizedPhone) || {
                  phone: normalizedPhone
                };
                restaurant = await Restaurant.findOne(phoneQuery);
                if (restaurant) {
                  return errorResponse(res, 400, `Restaurant already exists with this phone number. Please login.`);
                }
              }
              throw new Error(`Failed to create restaurant: ${retryError.message}. Please contact support.`);
            }
          } else if (createError.keyPattern && createError.keyPattern.phone) {
            // Phone duplicate key error - search in both formats
            const phoneQuery = buildPhoneQuery(normalizedPhone) || {
              phone: normalizedPhone
            };
            restaurant = await Restaurant.findOne(phoneQuery);
            if (restaurant) {
              return errorResponse(res, 400, `Restaurant already exists with this phone number. Please login.`);
            }
            throw new Error(`Phone number already exists: ${createError.message}`);
          } else if (createError.keyPattern && createError.keyPattern.slug) {
            // Check if it's a slug conflict
            // Retry with unique slug
            const baseSlug = restaurantData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            let counter = 1;
            let uniqueSlug = `${baseSlug}-${counter}`;
            while (await Restaurant.findOne({
              slug: uniqueSlug
            })) {
              counter++;
              uniqueSlug = `${baseSlug}-${counter}`;
            }
            restaurantData.slug = uniqueSlug;
            try {
              restaurant = await Restaurant.create(restaurantData);
            } catch (retryError) {
              // If still fails, check if restaurant exists
              const findQuery = normalizedPhone ? {
                phone: normalizedPhone
              } : {
                email: email?.toLowerCase().trim()
              };
              restaurant = await Restaurant.findOne(findQuery);
              if (!restaurant) {
                throw retryError;
              }
              return errorResponse(res, 400, `Restaurant already exists with this ${identifierType}. Please login.`);
            }
          } else {
            // Other duplicate key errors (email, phone)
            const findQuery = normalizedPhone ? {
              phone: normalizedPhone
            } : {
              email: email?.toLowerCase().trim()
            };
            restaurant = await Restaurant.findOne(findQuery);
            if (!restaurant) {
              throw createError;
            }
            return errorResponse(res, 400, `Restaurant already exists with this ${identifierType}. Please login.`);
          }
        } else {
          throw createError;
        }
      }
    } else {
      // Login (with optional auto-registration)
      // For phone, search in both formats (with and without country code) to handle old data
      let findQuery;
      if (normalizedPhone) {
        // Check if normalized phone has country code (starts with 91 and is 12 digits)
        if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
          // Search for both: with country code (917610416911) and without (7610416911)
          const phoneWithoutCountryCode = normalizedPhone.substring(2);
          findQuery = {
            $or: [{
              phone: normalizedPhone
            }, {
              phone: phoneWithoutCountryCode
            }, {
              phone: `+${normalizedPhone}`
            }, {
              phone: `+91${phoneWithoutCountryCode}`
            }]
          };
        } else {
          // If it's already without country code, also check with country code
          findQuery = {
            $or: [{
              phone: normalizedPhone
            }, {
              phone: `91${normalizedPhone}`
            }, {
              phone: `+91${normalizedPhone}`
            }, {
              phone: `+${normalizedPhone}`
            }]
          };
        }
      } else {
        findQuery = {
          email: email?.toLowerCase().trim()
        };
      }
      restaurant = await Restaurant.findOne(findQuery);
      if (isAbandonedIncompleteRestaurant(restaurant)) {
        await Restaurant.deleteOne({
          _id: restaurant._id
        });
        restaurant = null;
      }
      // Handle reset-password purpose
      if (purpose === 'reset-password') {
        if (!restaurant) {
          return errorResponse(res, 404, 'No restaurant account found with this email.');
        }
        // Verify OTP for password reset (pass normalized phone when applicable)
        await otpService.verifyOTP(normalizedPhone || phone || null, otp, purpose, email || null);
        return successResponse(res, 200, 'OTP verified. You can now reset your password.', {
          verified: true,
          email: restaurant.email
        });
      }

      // Verify OTP first (pass normalized phone for consistency with storage)
      await otpService.verifyOTP(normalizedPhone || phone || null, otp, purpose, email || null);

      if (!restaurant && !name) {
        // OTP is valid, now ask client for name to complete auto-registration.
        return successResponse(res, 200, 'Restaurant not found. Please provide restaurant name for registration.', {
          needsName: true,
          identifierType,
          identifier
        });
      }

      if (!restaurant) {
        // Auto-register new restaurant after OTP verification
        const restaurantData = {
          name,
          signupMethod: normalizedPhone ? 'phone' : 'email'
        };
        if (normalizedPhone) {
          restaurantData.phone = normalizedPhone;
          restaurantData.phoneVerified = true;
          restaurantData.ownerPhone = normalizedPhone;
          // For phone signup, set ownerEmail to empty string or phone-based email
          restaurantData.ownerEmail = email || `${normalizedPhone}@restaurant.appzeto.com`;
          // Explicitly don't set email field for phone signups to avoid null duplicate key error
        }
        if (email) {
          restaurantData.email = email.toLowerCase().trim();
          restaurantData.ownerEmail = email.toLowerCase().trim();
        }
        // Ensure email is not set to null or undefined
        if (!email && !phone) {
          // This shouldn't happen due to validation, but just in case
          throw new Error('Either phone or email must be provided');
        }
        if (password && !phone) {
          restaurantData.password = password;
        }
        restaurantData.ownerName = name;

        // Set isActive to false - restaurant needs admin approval before becoming active
        restaurantData.isActive = false;
        try {
          // For phone signups, ensure email field is not included
          if (phone && !email) {
            const docToInsert = {
              ...restaurantData
            };
            // Explicitly remove email field
            delete docToInsert.email;
            restaurant = await Restaurant.create(docToInsert);
          } else {
            restaurant = await Restaurant.create(restaurantData);
          }
        } catch (createError) {
          logger.error(`Error creating restaurant (auto-register): ${createError.message}`, {
            code: createError.code,
            keyPattern: createError.keyPattern,
            phone,
            email,
            restaurantData: {
              ...restaurantData,
              password: '***'
            }
          });
          if (createError.code === 11000) {
            // Check if it's an email null duplicate key error (common with phone signups)
            if (createError.keyPattern && createError.keyPattern.email && phone && !email) {
              logger.warn(`Email null duplicate key error for phone signup: ${phone}`, {
                error: createError.message,
                keyPattern: createError.keyPattern
              });
              // Try to find existing restaurant by phone (search in both formats)
              const phoneQuery = buildPhoneQuery(normalizedPhone) || {
                phone
              };
              restaurant = await Restaurant.findOne(phoneQuery);
              if (restaurant) { } else {
                // If not found, this is likely a database index issue - ensure email is completely removed
                // Create a fresh restaurantData object without email field
                const retryRestaurantData = {
                  name: restaurantData.name,
                  signupMethod: restaurantData.signupMethod,
                  phone: restaurantData.phone,
                  phoneVerified: restaurantData.phoneVerified,
                  ownerPhone: restaurantData.ownerPhone,
                  ownerEmail: restaurantData.ownerEmail,
                  ownerName: restaurantData.ownerName,
                  isActive: restaurantData.isActive
                };
                // Explicitly do NOT include email field
                if (restaurantData.password) {
                  retryRestaurantData.password = restaurantData.password;
                }
                try {
                  restaurant = await Restaurant.create(retryRestaurantData);
                } catch (retryError) {
                  logger.error(`Failed to create restaurant after email null fix: ${retryError.message}`, {
                    code: retryError.code,
                    keyPattern: retryError.keyPattern,
                    error: retryError
                  });
                  // Check if it's still a duplicate key error
                  if (retryError.code === 11000) {
                    // Try to find restaurant again (search in both formats)
                    const phoneQuery = buildPhoneQuery(normalizedPhone) || {
                      phone
                    };
                    restaurant = await Restaurant.findOne(phoneQuery);
                    if (restaurant) { } else {
                      throw new Error(`Failed to create restaurant: ${retryError.message}. Please contact support.`);
                    }
                  } else {
                    throw new Error(`Failed to create restaurant: ${retryError.message}. Please contact support.`);
                  }
                }
              }
            } else if (createError.keyPattern && createError.keyPattern.phone) {
              // Phone duplicate key error
              restaurant = await Restaurant.findOne({
                phone
              });
              if (restaurant) { } else {
                throw new Error(`Phone number already exists: ${createError.message}`);
              }
            } else if (createError.keyPattern && createError.keyPattern.slug) {
              // Check if it's a slug conflict
              // Retry with unique slug
              const baseSlug = restaurantData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              let counter = 1;
              let uniqueSlug = `${baseSlug}-${counter}`;
              while (await Restaurant.findOne({
                slug: uniqueSlug
              })) {
                counter++;
                uniqueSlug = `${baseSlug}-${counter}`;
              }
              restaurantData.slug = uniqueSlug;
              try {
                restaurant = await Restaurant.create(restaurantData);
              } catch (retryError) {
                // If still fails, check if restaurant exists
                const findQuery = phone ? {
                  phone
                } : {
                  email
                };
                restaurant = await Restaurant.findOne(findQuery);
                if (!restaurant) {
                  throw retryError;
                }
              }
            } else {
              // Other duplicate key errors (email, phone)
              const findExistingQuery = normalizedPhone ? buildPhoneQuery(normalizedPhone) : {
                email: email?.toLowerCase().trim()
              };
              restaurant = await Restaurant.findOne(findExistingQuery);
              if (!restaurant) {
                throw createError;
              }
            }
          } else {
            throw createError;
          }
        }
      } else {
        // Existing restaurant login - update verification status if needed
        if (phone && !restaurant.phoneVerified) {
          restaurant.phoneVerified = true;
          await restaurant.save();
        }
      }
    }

    // Generate tokens (email may be null for phone signups)
    const tokens = jwtService.generateTokens({
      userId: restaurant._id.toString(),
      role: 'restaurant',
      email: restaurant.email || restaurant.phone || restaurant.restaurantId
    });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return access token and restaurant info
    return successResponse(res, 200, 'Authentication successful', {
      accessToken: tokens.accessToken,
      restaurant: {
        id: restaurant._id,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        phoneVerified: restaurant.phoneVerified,
        signupMethod: restaurant.signupMethod,
        profileImage: restaurant.profileImage,
        isActive: restaurant.isActive,
        onboarding: restaurant.onboarding
      }
    });
  } catch (error) {
    logger.error(`Error verifying OTP: ${error.message}`);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * Register restaurant with email and password
 * POST /api/restaurant/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    ownerName,
    ownerEmail,
    ownerPhone
  } = req.body;
  if (!name || !email || !password) {
    return errorResponse(res, 400, 'Restaurant name, email, and password are required');
  }

  // Normalize phone number if provided
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
  if (phone && !normalizedPhone) {
    return errorResponse(res, 400, 'Invalid phone number format');
  }

  // Check if restaurant already exists
  const existingRestaurant = await Restaurant.findOne({
    $or: [{
      email: email.toLowerCase().trim()
    }, ...(normalizedPhone ? [{
      phone: normalizedPhone
    }] : [])]
  });
  if (existingRestaurant) {
    if (existingRestaurant.email === email.toLowerCase().trim()) {
      return errorResponse(res, 400, 'Restaurant with this email already exists. Please login.');
    }
    if (normalizedPhone && existingRestaurant.phone === normalizedPhone) {
      return errorResponse(res, 400, 'Restaurant with this phone number already exists. Please login.');
    }
  }

  // Create new restaurant
  const restaurantData = {
    name,
    email: email.toLowerCase().trim(),
    password,
    // Will be hashed by pre-save hook
    ownerName: ownerName || name,
    ownerEmail: (ownerEmail || email).toLowerCase().trim(),
    signupMethod: 'email',
    // Set isActive to false - restaurant needs admin approval before becoming active
    isActive: false
  };

  // Only include phone if provided (don't set to null)
  if (normalizedPhone) {
    restaurantData.phone = normalizedPhone;
    restaurantData.ownerPhone = ownerPhone ? normalizePhoneNumber(ownerPhone) : normalizedPhone;
  }
  const restaurant = await Restaurant.create(restaurantData);

  // Generate tokens (email may be null for phone signups)
  const tokens = jwtService.generateTokens({
    userId: restaurant._id.toString(),
    role: 'restaurant',
    email: restaurant.email || restaurant.phone || restaurant.restaurantId
  });

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return successResponse(res, 201, 'Registration successful', {
    accessToken: tokens.accessToken,
    restaurant: {
      id: restaurant._id,
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      email: restaurant.email,
      phone: restaurant.phone,
      phoneVerified: restaurant.phoneVerified,
      signupMethod: restaurant.signupMethod,
      profileImage: restaurant.profileImage,
      isActive: restaurant.isActive
    }
  });
});

/**
 * Login restaurant with email and password
 * POST /api/restaurant/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const {
    email,
    password
  } = req.body;
  if (!email || !password) {
    return errorResponse(res, 400, 'Email and password are required');
  }
  const restaurant = await Restaurant.findOne({
    email
  }).select('+password');
  if (!restaurant) {
    return errorResponse(res, 401, 'Invalid email or password');
  }
  if (!restaurant.isActive) {
    return errorResponse(res, 401, 'Restaurant account is inactive. Please contact support.');
  }

  // Check if restaurant has a password set
  if (!restaurant.password) {
    return errorResponse(res, 400, 'Account was created with phone. Please use OTP login.');
  }

  // Verify password
  const isPasswordValid = await restaurant.comparePassword(password);
  if (!isPasswordValid) {
    return errorResponse(res, 401, 'Invalid email or password');
  }

  // Generate tokens (email may be null for phone signups)
  const tokens = jwtService.generateTokens({
    userId: restaurant._id.toString(),
    role: 'restaurant',
    email: restaurant.email || restaurant.phone || restaurant.restaurantId
  });

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return successResponse(res, 200, 'Login successful', {
    accessToken: tokens.accessToken,
    restaurant: {
      id: restaurant._id,
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      email: restaurant.email,
      phone: restaurant.phone,
      phoneVerified: restaurant.phoneVerified,
      signupMethod: restaurant.signupMethod,
      profileImage: restaurant.profileImage,
      isActive: restaurant.isActive,
      onboarding: restaurant.onboarding
    }
  });
});

/**
 * Reset Password with OTP verification
 * POST /api/restaurant/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const {
    email,
    otp,
    newPassword
  } = req.body;
  if (!email || !otp || !newPassword) {
    return errorResponse(res, 400, 'Email, OTP, and new password are required');
  }
  if (newPassword.length < 6) {
    return errorResponse(res, 400, 'Password must be at least 6 characters long');
  }
  const restaurant = await Restaurant.findOne({
    email
  }).select('+password');
  if (!restaurant) {
    return errorResponse(res, 404, 'No restaurant account found with this email.');
  }

  // Verify OTP for reset-password purpose
  try {
    await otpService.verifyOTP(null, otp, 'reset-password', email);
  } catch (error) {
    logger.error(`OTP verification failed for password reset: ${error.message}`);
    return errorResponse(res, 400, 'Invalid or expired OTP. Please request a new one.');
  }

  // Update password
  restaurant.password = newPassword; // Will be hashed by pre-save hook
  await restaurant.save();
  return successResponse(res, 200, 'Password reset successfully. Please login with your new password.');
});

/**
 * Refresh Access Token
 * POST /api/restaurant/auth/refresh-token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return errorResponse(res, 401, 'Refresh token not found');
  }
  try {
    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(refreshToken);

    // Ensure it's a restaurant token
    if (decoded.role !== 'restaurant') {
      return errorResponse(res, 401, 'Invalid token for restaurant');
    }

    // Get restaurant from database
    const restaurant = await Restaurant.findById(decoded.userId).select('-password');
    if (!restaurant) {
      return errorResponse(res, 401, 'Restaurant not found');
    }

    // Allow inactive restaurants to refresh tokens - they need access to complete onboarding
    // The middleware will handle blocking inactive restaurants from accessing restricted routes

    // Generate new access token
    const accessToken = jwtService.generateAccessToken({
      userId: restaurant._id.toString(),
      role: 'restaurant',
      email: restaurant.email || restaurant.phone || restaurant.restaurantId
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
 * POST /api/restaurant/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  // Best-effort token cleanup so logout consistently removes FCM tokens from DB.
  try {
    let restaurantId = req.restaurant?._id ? String(req.restaurant._id) : null;
    if (!restaurantId) {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwtService.verifyAccessToken(token);
        if (decoded?.role === 'restaurant' && decoded?.userId) {
          restaurantId = String(decoded.userId);
        }
      }
    }

    if (restaurantId) {
      await Promise.all([
        DeviceToken.deleteMany({ userId: restaurantId, role: 'restaurant' }),
        Restaurant.findByIdAndUpdate(restaurantId, {
          $set: {            fcmTokensWeb: [],
            fcmTokensMobile: []
          }
        })
      ]);
    }
  } catch (cleanupErr) {
    logger.warn(`FCM cleanup on restaurant logout failed: ${cleanupErr.message}`);
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
 * Get current restaurant
 * GET /api/restaurant/auth/me
 */
export const getCurrentRestaurant = asyncHandler(async (req, res) => {
  const r = req.restaurant;
  const rmFallbackPhone = String(process.env.RM_NUMBER || '').trim();
  let zoneName = null;
  let tierName = null;
  let zoneIdOut = r.zoneId ? String(r.zoneId) : null;
  let tierIdOut = r.tierId ? String(r.tierId) : null;
  try {
    let zoneDoc = null;
    if (r.zoneId) {
      zoneDoc = await Zone.findById(r.zoneId).select('name zoneName tierId').lean();
      if (zoneDoc) {
        zoneName = zoneDoc.zoneName || zoneDoc.name || null;
      }
    }
    const effectiveTierId = r.tierId || zoneDoc?.tierId;
    if (effectiveTierId) {
      tierIdOut = String(effectiveTierId);
      const tierDoc = await Tier.findById(effectiveTierId).select('name').lean();
      if (tierDoc) {
        tierName = tierDoc.name || null;
      }
    }
  } catch (err) {
    logger.warn(`getCurrentRestaurant: could not resolve zone/tier: ${err.message}`);
  }

  return successResponse(res, 200, 'Restaurant retrieved successfully', {
    restaurant: {
      id: r._id,
      restaurantId: r.restaurantId,
      name: r.name,
      email: r.email,
      phone: r.phone,
      phoneVerified: r.phoneVerified,
      signupMethod: r.signupMethod,
      profileImage: r.profileImage,
      isActive: r.isActive,
      onboarding: r.onboarding,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
      ownerPhone: r.ownerPhone,
      // Include additional restaurant details
      cuisines: r.cuisines,
      openDays: r.openDays,
      location: r.location,
      primaryContactNumber: r.primaryContactNumber,
      deliveryTimings: r.deliveryTimings,
      menuImages: r.menuImages,
      slug: r.slug,
      isAcceptingOrders: r.isAcceptingOrders,
      deliveryRange: r.deliveryRange,
      rating: Number(r.rating || 0),
      totalRatings: Number(r.totalRatings || 0),
      // Include verification status
      rejectionReason: r.rejectionReason || null,
      approvedAt: r.approvedAt || null,
      rejectedAt: r.rejectedAt || null,
      businessModel: r.businessModel,
      subscription: r.subscription,
      relationshipManager: r.relationshipManager,
      rmFallbackPhone,
      preferences: r.preferences || { language: 'en' },
      // Zone / tier (for outlet info & delivery pricing context)
      zoneId: zoneIdOut,
      tierId: tierIdOut,
      zoneName,
      tierName
    }
  });
});

/**
 * Reverify Restaurant (Resubmit for approval)
 * POST /api/restaurant/auth/reverify
 */
export const reverifyRestaurant = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant; // Already attached by authenticate middleware

    // Check if restaurant was rejected
    if (!restaurant.rejectionReason) {
      return errorResponse(res, 400, 'Restaurant is not rejected. Only rejected restaurants can be reverified.');
    }

    // Clear rejection details and mark as pending again
    restaurant.rejectionReason = null;
    restaurant.rejectedAt = undefined;
    restaurant.rejectedBy = undefined;
    restaurant.isActive = false; // Keep inactive until approved

    await restaurant.save();
    return successResponse(res, 200, 'Restaurant reverified successfully. Waiting for admin approval. Verification will be done in 24 hours.', {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        isActive: restaurant.isActive,
        rejectionReason: null
      }
    });
  } catch (error) {
    logger.error(`Error reverifying restaurant: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to reverify restaurant');
  }
});

/**
 * Shared Google login finalizer for restaurant auth.
 * Accepts normalized Google identity payload and returns restaurant auth response.
 */
const finalizeRestaurantGoogleLogin = async ({
  res,
  googleId,
  email,
  name = 'Restaurant',
  picture = null,
  sourceLabel = 'Google'
}) => {
  if (!email) {
    logger.error(`${sourceLabel} login failed: Email not found in token`, {
      googleId
    });
    return errorResponse(res, 400, 'Email not found in Google user. Please ensure email is available in your Google account.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    logger.error(`${sourceLabel} login failed: Invalid email format`, {
      email
    });
    return errorResponse(res, 400, 'Invalid email format received from Google.');
  }

  let restaurant = await Restaurant.findOne({
    $or: [{
      googleId
    }, {
      email
    }]
  });
  if (restaurant) {
    if (!restaurant.googleId) {
      restaurant.googleId = googleId;
      restaurant.googleEmail = email;
      if (!restaurant.profileImage && picture) {
        restaurant.profileImage = {
          url: picture
        };
      }
      if (!restaurant.signupMethod) {
        restaurant.signupMethod = 'google';
      }
      await restaurant.save();
    }
  } else {
    const restaurantData = {
      name: String(name || 'Restaurant').trim(),
      email: email.toLowerCase().trim(),
      googleId,
      googleEmail: email.toLowerCase().trim(),
      signupMethod: 'google',
      profileImage: picture ? {
        url: picture
      } : null,
      ownerName: String(name || 'Restaurant').trim(),
      ownerEmail: email.toLowerCase().trim(),
      // Set isActive to false - restaurant needs admin approval before becoming active
      isActive: false
    };
  try {
      restaurant = await Restaurant.create(restaurantData);
    } catch (createError) {
      if (createError.code === 11000) {
        if (createError.keyPattern && createError.keyPattern.slug) {
          logger.warn('Slug conflict during Google restaurant creation, retrying with unique slug', {
            email
          });
          const baseSlug = String(name || 'Restaurant')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'restaurant';
          let counter = 1;
          let uniqueSlug = `${baseSlug}-${counter}`;
          while (await Restaurant.findOne({ slug: uniqueSlug })) {
            counter += 1;
            uniqueSlug = `${baseSlug}-${counter}`;
          }

          restaurantData.slug = uniqueSlug;
          restaurant = await Restaurant.create(restaurantData);
        } else {
          logger.warn('Duplicate key error during restaurant creation, retrying find', {
            email
          });
          restaurant = await Restaurant.findOne({
            email
          });
          if (!restaurant) {
            logger.error('Restaurant not found after duplicate key error', {
              email
            });
            throw createError;
          }
          if (!restaurant.googleId) {
            restaurant.googleId = googleId;
            restaurant.googleEmail = email;
            if (!restaurant.profileImage && picture) {
              restaurant.profileImage = {
                url: picture
              };
            }
            if (!restaurant.signupMethod) {
              restaurant.signupMethod = 'google';
            }
            await restaurant.save();
          }
        }
      } else {
        logger.error(`Error creating restaurant via ${sourceLabel} login`, {
          error: createError.message,
          email
        });
        throw createError;
      }
    }
  }

  // Distinguish pending approval from truly deactivated accounts.
  // Pending restaurants can login to continue onboarding.
  const isPendingApproval = !restaurant.isActive && !restaurant.approvedAt && !restaurant.rejectedAt;
  if (!restaurant.isActive && !isPendingApproval) {
    logger.warn('Deactivated restaurant attempted Google login', {
      restaurantId: restaurant._id,
      email
    });
    return errorResponse(res, 403, 'Your restaurant account has been deactivated. Please contact support.');
  }

  // Generate JWT tokens for our app (email may be null for phone signups)
  const tokens = jwtService.generateTokens({
    userId: restaurant._id.toString(),
    role: 'restaurant',
    email: restaurant.email || restaurant.phone || restaurant.restaurantId
  });

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return successResponse(
    res,
    200,
    isPendingApproval
      ? 'Google authentication successful. Your account is pending admin approval.'
      : `${sourceLabel} authentication successful`,
    {
      accessToken: tokens.accessToken,
      restaurant: {
        id: restaurant._id,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        phoneVerified: restaurant.phoneVerified,
        signupMethod: restaurant.signupMethod,
        profileImage: restaurant.profileImage,
        isActive: restaurant.isActive,
        isPendingApproval,
        onboarding: restaurant.onboarding
      }
    }
  );
};

/**
 * Login / register using Firebase Google ID token
 * POST /api/restaurant/auth/firebase/google-login
 */
export const firebaseGoogleLogin = asyncHandler(async (req, res) => {
  const {
    idToken
  } = req.body;
  if (!idToken) {
    return errorResponse(res, 400, 'Firebase ID token is required');
  }

  // Ensure Firebase Admin is configured (initialize lazily on first request)
  if (!firebaseAuthService.isEnabled()) {
    await firebaseAuthService.init();
  }
  if (!firebaseAuthService.isEnabled()) {
    return errorResponse(res, 500, 'Firebase Auth is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend .env');
  }
  try {
    // Verify Firebase ID token
    const decoded = await firebaseAuthService.verifyIdToken(idToken);
    const firebaseUid = decoded.uid;
    const email = decoded.email || null;
    const name = decoded.name || decoded.display_name || 'Restaurant';
    const picture = decoded.picture || decoded.photo_url || null;
    return finalizeRestaurantGoogleLogin({
      res,
      googleId: firebaseUid,
      email,
      name,
      picture,
      sourceLabel: 'Firebase Google'
    });
  } catch (error) {
    logger.error(`Error in Firebase Google login: ${error.message}`);
    return errorResponse(res, 400, error.message || 'Firebase Google authentication failed');
  }
});

/**
 * Login / register using native Google token (Flutter/mobile bridge)
 * POST /api/restaurant/auth/google/native-login
 */
export const googleNativeLogin = asyncHandler(async (req, res) => {
  const {
    idToken,
    accessToken
  } = req.body;

  if (!idToken && !accessToken) {
    return errorResponse(res, 400, 'Google token is required');
  }

  try {
    let googleUser = null;

    if (accessToken) {
      const tokenData = await googleAuthService.getUserInfoFromToken({
        access_token: accessToken
      });
      googleUser = {
        googleId: tokenData.googleId,
        email: tokenData.email,
        name: tokenData.name || 'Restaurant',
        picture: tokenData.picture || null
      };
    } else {
      const payload = await googleAuthService.verifyIdToken(idToken);
      googleUser = {
        googleId: payload?.sub || payload?.uid || null,
        email: payload?.email || null,
        name: payload?.name || payload?.display_name || payload?.given_name || 'Restaurant',
        picture: payload?.picture || payload?.photo_url || null
      };
    }

    return finalizeRestaurantGoogleLogin({
      res,
      googleId: googleUser.googleId,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      sourceLabel: 'Native Google'
    });
  } catch (error) {
    logger.error(`Error in native Google login: ${error.message}`);
    return errorResponse(res, 400, error.message || 'Native Google authentication failed');
  }
});

