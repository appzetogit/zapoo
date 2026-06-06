import express from 'express';
import {
  submitSignupDetails,
  submitSignupDocuments
} from '../controllers/deliverySignupController.js';
import { authenticate } from '../middleware/deliveryAuth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Signup routes
router.post('/signup/details', validate(Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().trim().optional().allow(null, ''),
  address: Joi.string().trim().required(),
  city: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  vehicleType: Joi.string().valid('bike', 'scooter', 'bicycle', 'car').required(),
  vehicleName: Joi.string().trim().optional().allow(null, ''),
  vehicleNumber: Joi.when('vehicleType', {
    is: 'bicycle',
    then: Joi.string().trim().optional().allow(null, ''),
    otherwise: Joi.string().trim().required()
  }),
  panNumber: Joi.string().trim().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
    'string.pattern.base': 'Invalid PAN number format (e.g., ABCDE1234F)'
  }),
  aadharNumber: Joi.string().trim().pattern(/^\d{12}$/).required().messages({
    'string.pattern.base': 'Aadhar number must be exactly 12 digits'
  })
})), submitSignupDetails);

router.post('/signup/documents', validate(Joi.object({
  profilePhoto: Joi.object({
    url: Joi.string().uri().required(),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).required(),
  aadharPhoto: Joi.object({
    url: Joi.string().uri().required(),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).required(),
  panPhoto: Joi.object({
    url: Joi.string().uri().required(),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).required(),
  drivingLicensePhoto: Joi.object({
    url: Joi.string().uri().required(),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).required()
})), submitSignupDocuments);

export default router;

