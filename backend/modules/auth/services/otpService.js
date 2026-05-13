import Otp from '../models/Otp.js';
import smsIndiaHubService from './smsIndiaHubService.js';
import emailService from './emailService.js';
import { normalizePhoneNumber } from '../../../shared/utils/phoneUtils.js';
import winston from 'winston';
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

// Test phone numbers that should use default OTP
const TEST_PHONE_NUMBERS = ['7610416911', '7691810506', '7974161582', '9009925021', '6375095971', '9999999999', '8888888888'];

// Default OTP for test phone numbers
const DEFAULT_TEST_OTP = '110211';

/**
 * Extract phone number digits (without country code)
 * @param {string} phone - Phone number in format like "+91 9098569620" or "+91-9098569620"
 * @returns {string} - Phone number digits only (e.g., "9098569620")
 */
const extractPhoneDigits = phone => {
  if (!phone) return '';
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // If starts with country code (like 91), remove it to get last 10 digits
  // For Indian numbers, country code is 91, so we take last 10 digits
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  // If exactly 10 digits or less, return as is
  return digits.length <= 10 ? digits : digits.slice(-10);
};

/**
 * Check if a phone number is a test number
 * @param {string} phone - Phone number in any format
 * @returns {boolean} - True if phone number is a test number
 */
const isTestPhoneNumber = phone => {
  const phoneDigits = extractPhoneDigits(phone);
  return TEST_PHONE_NUMBERS.includes(phoneDigits);
};

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 * Supports both phone and email OTP
 */
class OTPService {
  /**
   * Generate and send OTP via phone or email
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} email - Email address (optional if phone provided)
   * @param {string} purpose - Purpose of OTP (login, register, etc.)
   * @returns {Promise<Object>}
   */
  async generateAndSendOTP(phone = null, purpose = 'login', email = null) {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }
      const identifier = phone || email;
      const identifierType = phone ? 'phone' : 'email';

      // Normalize phone if provided
      const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

      // Check rate limiting (max 3 OTPs per identifier per hour) - using MongoDB
      // Use normalized phone for rate limit query to match how OTPs are stored
      if (process.env.NODE_ENV === 'production') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const rateLimitQuery = {
          purpose,
          createdAt: {
            $gte: oneHourAgo
          }
        };
        if (normalizedPhone) rateLimitQuery.phone = normalizedPhone;
        else if (email) rateLimitQuery.email = email;
        const recentOtpCount = await Otp.countDocuments(rateLimitQuery);
        if (recentOtpCount >= 3) {
          throw new Error('Too many OTP requests. Please try again after some time.');
        }
      }

      // Generate OTP (use default for test phone numbers)
      const otp = phone && isTestPhoneNumber(phone) ? DEFAULT_TEST_OTP : generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Build query for invalidating previous OTPs
      // CRITICAL FIX: To prevent race conditions where near-simultaneous requests invalidate each other,
      // we exclude OTPs created in the last 2 seconds from invalidation.
      const twoSecondsAgo = new Date(Date.now() - 2000);
      const invalidateQuery = {
        purpose,
        verified: false,
        createdAt: { $lt: twoSecondsAgo }
      };
      if (normalizedPhone) invalidateQuery.phone = normalizedPhone;
      if (email) invalidateQuery.email = email;

      // Invalidate previous OTPs for this identifier and purpose
      const invalidationResult = await Otp.updateMany(invalidateQuery, {
        verified: true
      });
      if (invalidationResult.modifiedCount > 0) {
        console.log(`[OTPService] Invalidated ${invalidationResult.modifiedCount} previous unverified OTPs for ${normalizedPhone || email}`);
      }

      // Store OTP in database
      const otpData = {
        otp,
        purpose,
        expiresAt
      };
      if (normalizedPhone) otpData.phone = normalizedPhone;
      if (email) otpData.email = email;
      const otpRecord = await Otp.create(otpData);

      // Send OTP via SMS or Email
      if (phone) {
        // Skip actual SMS sending for test phone numbers
        if (!isTestPhoneNumber(phone)) {
          // Use SMSIndia Hub for phone OTP
          await smsIndiaHubService.sendOTP(phone, otp, purpose);
        } else { }
      } else if (email) {
        // Keep email service as is
        await emailService.sendOTP(email, otp, purpose);
      }
      return {
        success: true,
        message: `OTP sent successfully to ${identifierType === 'phone' ? 'phone' : 'email'}`,
        expiresIn: 300,
        // 5 minutes in seconds
        identifierType
      };
    } catch (error) {
      console.error(`[OTPService] Error generating OTP for ${phone || email}:`, error);
      logger.error(`Error generating OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} otp - OTP code
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async verifyOTP(phone = null, otp, purpose = 'login', email = null) {
    try {
      // Validate that either phone or email is provided
      if (!phone && !email) {
        throw new Error('Either phone or email must be provided');
      }
      const identifier = phone || email;
      const identifierType = phone ? 'phone' : 'email';

      // Normalize phone if provided
      const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;

      // Check if this is a test phone number and OTP matches default test OTP
      if (phone && isTestPhoneNumber(phone) && otp === DEFAULT_TEST_OTP) {
        return {
          success: true,
          message: 'OTP verified successfully'
        };
      }

      // Verify OTP from database
      // For reset-password purpose, allow already-verified OTPs within 10 minutes
      let otpRecord;
      if (purpose === 'reset-password') {
        // First try to find unverified OTP
        const unverifiedQuery = {
          otp,
          purpose,
          verified: false,
          expiresAt: {
            $gt: new Date()
          }
        };
        if (normalizedPhone) unverifiedQuery.phone = normalizedPhone;
        if (email) unverifiedQuery.email = email;
        otpRecord = await Otp.findOne(unverifiedQuery);

        // If not found, check for already-verified OTP within last 10 minutes
        if (!otpRecord) {
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          const verifiedQuery = {
            otp,
            purpose,
            verified: true,
            expiresAt: {
              $gt: new Date()
            },
            updatedAt: {
              $gt: tenMinutesAgo
            }
          };
          if (normalizedPhone) verifiedQuery.phone = normalizedPhone;
          if (email) verifiedQuery.email = email;
          otpRecord = await Otp.findOne(verifiedQuery);
          if (otpRecord) {
            console.log(`[OTPService] OTP already verified for ${phone || email} (accepted from recent verification)`);
            return {
              success: true,
              message: 'OTP verified successfully'
            };
          }
        }
      } else {
        // For other purposes, check unverified OTPs
        // For Indian numbers, match both normalized (919876543210) and 10-digit (9876543210)
        // to handle any legacy or format mismatch
        const query = {
          otp,
          purpose,
          verified: false,
          expiresAt: {
            $gt: new Date()
          }
        };
        if (normalizedPhone) {
          if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
            query.$or = [
              { phone: normalizedPhone },
              { phone: normalizedPhone.slice(-10) }
            ];
          } else {
            query.phone = normalizedPhone;
          }
        }
        if (email) query.email = email;
        otpRecord = await Otp.findOne(query);

        if (!otpRecord) {
          // Allow recently-verified OTP reuse for short two-step flows
          // (e.g., valid OTP -> ask name -> submit). Keep window bounded.
          const recentlyVerifiedQuery = {
            otp,
            purpose,
            verified: true,
            updatedAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
          };
          if (normalizedPhone) {
            if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
              recentlyVerifiedQuery.$or = [
                { phone: normalizedPhone },
                { phone: normalizedPhone.slice(-10) }
              ];
            } else {
              recentlyVerifiedQuery.phone = normalizedPhone;
            }
          }
          if (email) recentlyVerifiedQuery.email = email;

          const recentlyVerified = await Otp.findOne(recentlyVerifiedQuery);
          if (recentlyVerified) {
            console.log(`[OTPService] OTP verified (accepted from extremely recent verification) for ${normalizedPhone || email}`);
            return {
              success: true,
              message: 'OTP verified successfully'
            };
          }

          // Debug: log why verification failed (without leaking OTP)
          const anyStatusQuery = { purpose, otp };
          if (normalizedPhone) {
            if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
              anyStatusQuery.$or = [
                { phone: normalizedPhone },
                { phone: normalizedPhone.slice(-10) }
              ];
            } else {
              anyStatusQuery.phone = normalizedPhone;
            }
          }
          if (email) anyStatusQuery.email = email;
          const anyRec = await Otp.findOne(anyStatusQuery);
          if (anyRec) {
            console.warn(`[OTPService] Verify failed: record exists but otp/expiry mismatch. purpose=${purpose}, identifier=${normalizedPhone ? 'phone' : 'email'}, verified=${anyRec.verified}, expiresAt=${anyRec.expiresAt}`);
          } else {
            console.warn(`[OTPService] Verify failed: no OTP record for purpose=${purpose}, identifier=${normalizedPhone || email}`);
          }
        }
      }

      if (!otpRecord) {
        // Increment attempts for security (use same phone matching as main query)
        const incrementQuery = { purpose, verified: false };
        if (normalizedPhone) {
          if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
            incrementQuery.$or = [
              { phone: normalizedPhone },
              { phone: normalizedPhone.slice(-10) }
            ];
          } else {
            incrementQuery.phone = normalizedPhone;
          }
        }
        if (email) incrementQuery.email = email;
        await Otp.updateMany(incrementQuery, {
          $inc: { attempts: 1 }
        });
        throw new Error('Invalid or expired OTP');
      }

      // Check attempts
      if (otpRecord.attempts >= 5) {
        throw new Error('Too many failed attempts. Please request a new OTP.');
      }

      // Mark as verified
      otpRecord.verified = true;
      await otpRecord.save();
      console.log(`[OTPService] OTP verified successfully for ${phone || email}`);
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } catch (error) {
      console.error(`[OTPService] Error verifying OTP for ${phone || email}:`, error.message);
      logger.error(`Error verifying OTP: ${error.message}`, {
        phone,
        email,
        purpose,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resend OTP
   * @param {string} phone - Phone number (optional if email provided)
   * @param {string} purpose - Purpose of OTP
   * @param {string} email - Email address (optional if phone provided)
   * @returns {Promise<Object>}
   */
  async resendOTP(phone = null, purpose = 'login', email = null) {
    return await this.generateAndSendOTP(phone, purpose, email);
  }
}
export default new OTPService();
