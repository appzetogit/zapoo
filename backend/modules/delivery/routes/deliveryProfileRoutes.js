import express from 'express';
import { getProfile, updateProfile, reverify, getPreferences, updatePreferences, deleteProfile } from '../controllers/deliveryProfileController.js';
import { authenticate } from '../middleware/deliveryAuth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';
import {
  createSupportTicket,
  getDeliveryTickets,
  getTicketById
} from '../../admin/controllers/deliverySupportTicketController.js';
import { getMyChallenges } from '../controllers/deliveryChallengeController.js';

const router = express.Router();

const VEHICLE_NUMBER_REGEX = /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
const PROFILE_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/;
const CITY_STATE_REGEX = /^[A-Za-z\s]{2,50}$/;
const ZIP_CODE_REGEX = /^\d{6}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
const BANK_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/;

// All routes require authentication
router.use(authenticate);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', validate(Joi.object({
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
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().min(2).max(100).pattern(BANK_NAME_REGEX).optional().allow(null, ''),
      accountNumber: Joi.string().trim().pattern(BANK_ACCOUNT_REGEX).optional().allow(null, ''),
      ifscCode: Joi.string().trim().uppercase().pattern(IFSC_REGEX).optional().allow(null, ''),
      bankName: Joi.string().trim().min(2).max(100).pattern(BANK_NAME_REGEX).optional().allow(null, '')
    }).optional()
  }).optional()
})), updateProfile);
router.delete('/profile', deleteProfile);
router.get('/preferences', getPreferences);
router.put('/preferences', validate(Joi.object({
  language: Joi.string().valid('en', 'hi', 'bn').required()
})), updatePreferences);

// Reverify route (resubmit for approval)
router.post('/reverify', reverify);

// Support tickets routes
router.post('/support-tickets', validate(Joi.object({
  subject: Joi.string().trim().min(3).max(200).required().messages({
    'string.empty': 'Subject is required',
    'string.min': 'Subject must be at least 3 characters',
    'string.max': 'Subject must not exceed 200 characters',
    'any.required': 'Subject is required'
  }),
  description: Joi.string().trim().min(10).max(2000).required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 10 characters',
    'string.max': 'Description must not exceed 2000 characters',
    'any.required': 'Description is required'
  }),
  category: Joi.string().valid('payment', 'account', 'technical', 'order', 'other').optional().allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional().allow('', null)
})), createSupportTicket);

router.get('/support-tickets', getDeliveryTickets);
router.get('/support-tickets/:id', getTicketById);
router.get('/challenges', getMyChallenges);

export default router;
