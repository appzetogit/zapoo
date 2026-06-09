import express from 'express';
import {
  sendOTP,
  verifyOTP,
  register,
  login,
  resetPassword,
  refreshToken,
  logout,
  getCurrentRestaurant,
  reverifyRestaurant,
  firebaseGoogleLogin,
  googleNativeLogin
} from '../controllers/restaurantAuthController.js';
import { authenticate } from '../middleware/restaurantAuth.js';
import { validate } from '../../../shared/middleware/validate.js';
import Joi from 'joi';

const router = express.Router();

// Validation patterns
const nameRegex = /^[a-zA-Z\s\-]+$/;
const phoneRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

// Validation schemas
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(phoneRegex)
    .messages({
      'string.pattern.base': 'Invalid phone number format. Please provide a valid 10-digit mobile number.'
    })
    .optional(),
  email: Joi.string().email().optional(),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone', 'verify-email')
    .default('login')
}).or('phone', 'email');

const verifyOTPSchema = Joi.object({
  phone: Joi.string().pattern(phoneRegex).optional(),
  email: Joi.string().email().optional(),
  otp: Joi.string().required().length(6),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone', 'verify-email')
    .default('login'),
  name: Joi.string()
    .pattern(nameRegex)
    .min(2)
    .max(50)
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, and hyphens'
    })
    .when('purpose', {
      is: 'register',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  password: Joi.string().min(6).max(100).optional(),
  fcmToken: Joi.string().optional(),
  platform: Joi.string().optional()
}).or('phone', 'email');

const registerSchema = Joi.object({
  name: Joi.string()
    .pattern(nameRegex)
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.pattern.base': 'Restaurant name can only contain letters, spaces, and hyphens'
    }),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  phone: Joi.string().pattern(phoneRegex).optional(),
  ownerName: Joi.string()
    .pattern(nameRegex)
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.pattern.base': 'Owner name can only contain letters, spaces, and hyphens'
    }),
  ownerEmail: Joi.string().email().optional(),
  ownerPhone: Joi.string().pattern(phoneRegex).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().required().length(6),
  newPassword: Joi.string().min(6).max(100).required()
});

const firebaseGoogleLoginSchema = Joi.object({
  idToken: Joi.string().required()
});

const nativeGoogleLoginSchema = Joi.object({
  idToken: Joi.string().optional(),
  accessToken: Joi.string().optional()
}).or('idToken', 'accessToken');

// Public routes
router.post('/send-otp', validate(sendOTPSchema), sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/firebase/google-login', validate(firebaseGoogleLoginSchema), firebaseGoogleLogin);
router.post('/google/native-login', validate(nativeGoogleLoginSchema), googleNativeLogin);

// Protected routes
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getCurrentRestaurant);
router.post('/reverify', authenticate, reverifyRestaurant);

export default router;
