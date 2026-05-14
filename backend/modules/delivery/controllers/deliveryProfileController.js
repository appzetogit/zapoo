import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../models/Delivery.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';
import winston from 'winston';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { deleteDeliveryAccountCascade } from '../../../shared/services/accountDeletionService.js';
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

const VEHICLE_NUMBER_REGEX = /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
const PROFILE_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/;
const CITY_STATE_REGEX = /^[A-Za-z\s]{2,50}$/;
const ZIP_CODE_REGEX = /^\d{6}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
const BANK_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/;

/**
 * Get Delivery Partner Profile
 * GET /api/delivery/profile
 */
export const getProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery; // From authenticate middleware

    // Populate related fields if needed
    const profile = await Delivery.findById(delivery._id).select('-password -refreshToken').lean();
    if (!profile) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }
    return successResponse(res, 200, 'Profile retrieved successfully', {
      profile
    });
  } catch (error) {
    logger.error(`Error fetching delivery profile: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch profile');
  }
});

/**
 * Update Delivery Partner Profile
 * PUT /api/delivery/profile
 */
const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).pattern(PROFILE_NAME_REGEX).optional(),
  email: Joi.string().email().lowercase().trim().optional().allow(null, ''),
  dateOfBirth: Joi.date().max('now').optional().allow(null),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').optional(),
  vehicle: Joi.object({
    type: Joi.string().valid('bike', 'scooter', 'bicycle', 'car').optional(),
    number: Joi.string().trim().uppercase().pattern(VEHICLE_NUMBER_REGEX).optional().allow(null, ''),
    model: Joi.string().trim().optional().allow(null, ''),
    brand: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  location: Joi.object({
    addressLine1: Joi.string().trim().max(120).optional().allow(null, ''),
    addressLine2: Joi.string().trim().max(120).optional().allow(null, ''),
    area: Joi.string().trim().max(80).optional().allow(null, ''),
    city: Joi.string().trim().pattern(CITY_STATE_REGEX).optional().allow(null, ''),
    state: Joi.string().trim().pattern(CITY_STATE_REGEX).optional().allow(null, ''),
    zipCode: Joi.string().trim().pattern(ZIP_CODE_REGEX).optional().allow(null, '')
  }).optional(),
  profileImage: Joi.object({
    url: Joi.string().uri().optional().allow(null, ''),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  documents: Joi.object({
    pan: Joi.object({
      number: Joi.string().trim().uppercase().optional().allow(null, '')
    }).optional(),
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().min(2).max(100).pattern(BANK_NAME_REGEX).optional().allow(null, ''),
      accountNumber: Joi.string().trim().pattern(BANK_ACCOUNT_REGEX).optional().allow(null, ''),
      ifscCode: Joi.string().trim().uppercase().pattern(IFSC_REGEX).optional().allow(null, ''),
      bankName: Joi.string().trim().min(2).max(100).pattern(BANK_NAME_REGEX).optional().allow(null, ''),
      upiId: Joi.string().trim().max(100).optional().allow(null, ''),
      upiQrCode: Joi.string().uri().trim().max(1000).optional().allow(null, '')
    }).optional()
  }).optional()
});
export const updateProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const updateData = req.body;

    // Validate input
    const {
      error
    } = updateProfileSchema.validate(updateData);
    if (error) {
      return errorResponse(res, 400, error.details[0].message);
    }

    // Handle nested documents.bankDetails update properly
    const setData = {
      ...updateData
    };
    if (updateData.documents?.bankDetails) {
      // Merge bankDetails with existing documents
      setData['documents.bankDetails'] = {
        ...delivery.documents?.bankDetails,
        ...updateData.documents.bankDetails
      };
      // Remove the nested documents object to avoid conflicts
      delete setData.documents;
    }

    // Update profile
    const updatedDelivery = await Delivery.findByIdAndUpdate(delivery._id, {
      $set: setData
    }, {
      new: true,
      runValidators: true
    }).select('-password -refreshToken');
    if (!updatedDelivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }
    return successResponse(res, 200, 'Profile updated successfully', {
      profile: updatedDelivery
    });
  } catch (error) {
    logger.error(`Error updating delivery profile: ${error.message}`);

    // Handle duplicate email error
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Email already exists');
    }
    return errorResponse(res, 500, 'Failed to update profile');
  }
});

export const getPreferences = asyncHandler(async (req, res) => {
  const delivery = await Delivery.findById(req.delivery._id).select('preferences').lean();
  if (!delivery) {
    return errorResponse(res, 404, 'Delivery partner not found');
  }

  return successResponse(res, 200, 'Preferences retrieved successfully', {
    preferences: {
      language: delivery.preferences?.language || 'en'
    }
  });
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const delivery = await Delivery.findById(req.delivery._id);
  if (!delivery) {
    return errorResponse(res, 404, 'Delivery partner not found');
  }

  delivery.preferences = delivery.preferences || {};
  delivery.preferences.language = normalizeLocale(req.body?.language);
  await delivery.save();

  return successResponse(res, 200, 'Preferences updated successfully', {
    preferences: {
      language: delivery.preferences.language
    }
  });
});

/**
 * Reverify Delivery Partner (Resubmit for approval)
 * POST /api/delivery/reverify
 */
export const reverify = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    if (delivery.status !== 'blocked') {
      return errorResponse(res, 400, 'Only rejected delivery partners can resubmit for verification');
    }

    // Reset to pending status and clear rejection details
    delivery.status = 'pending';
    delivery.isActive = true; // Allow login to see verification message
    delivery.rejectionReason = undefined;
    delivery.rejectedAt = undefined;
    delivery.rejectedBy = undefined;
    await delivery.save();
    return successResponse(res, 200, 'Request resubmitted for verification successfully', {
      profile: {
        _id: delivery._id.toString(),
        name: delivery.name,
        status: delivery.status
      }
    });
  } catch (error) {
    logger.error(`Error reverifying delivery partner: ${error.message}`);
    return errorResponse(res, 500, 'Failed to resubmit for verification');
  }
});

/**
 * Delete Delivery Partner account with related data
 * DELETE /api/delivery/profile
 */
export const deleteProfile = asyncHandler(async (req, res) => {
  try {
    const deliveryId = req.delivery._id;
    const existingDelivery = await Delivery.findById(deliveryId).select('_id').lean();
    if (!existingDelivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    await deleteDeliveryAccountCascade({ deliveryId });
    return successResponse(res, 200, 'Delivery account deleted successfully');
  } catch (error) {
    logger.error(`Error deleting delivery account: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, 'Failed to delete delivery account');
  }
});
