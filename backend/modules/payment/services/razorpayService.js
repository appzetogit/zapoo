import Razorpay from 'razorpay';
import crypto from 'crypto';
import winston from 'winston';
import { getRazorpayCredentials } from '../../../shared/utils/envService.js';
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});
const razorpayDebug = () => {};

// Initialize Razorpay instance
let razorpayInstance = null;
const initializeRazorpay = async () => {
  try {
    const credentials = await getRazorpayCredentials();
    const keyId = credentials.keyId;
    const keySecret = credentials.keySecret;
    razorpayDebug('initialize_start', {
      hasKeyId: Boolean(keyId),
      hasKeySecret: Boolean(keySecret),
      keyIdPrefix: keyId ? String(keyId).slice(0, 6) : null
    });
    if (!keyId || !keySecret) {
      logger.warn('Razorpay credentials not found.');
      return null;
    }
    try {
      razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });
      razorpayDebug('initialize_success', {
        keyIdPrefix: keyId ? String(keyId).slice(0, 6) : null
      });
      return razorpayInstance;
    } catch (error) {
      logger.error(`Error initializing Razorpay: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  } catch (error) {
    logger.error(`Error fetching Razorpay credentials: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
};

// Get Razorpay instance
const getRazorpayInstance = async () => {
  if (!razorpayInstance) {
    return await initializeRazorpay();
  }
  return razorpayInstance;
};

/**
 * Create a Razorpay order
 * @param {Object} options - Order options
 * @param {Number} options.amount - Amount in paise (e.g., 10000 for ₹100)
 * @param {String} options.currency - Currency code (default: INR)
 * @param {String} options.receipt - Receipt ID
 * @param {Object} options.notes - Additional notes
 * @returns {Promise<Object>} Razorpay order object
 */
const createOrder = async options => {
  const razorpay = await getRazorpayInstance();
  if (!razorpay) {
    logger.error('Razorpay instance is null - credentials may be missing or invalid');
    throw new Error('Razorpay is not initialized. Please check your credentials.');
  }
  try {
    const orderOptions = {
      amount: options.amount,
      // Amount in paise
      currency: options.currency || 'INR',
      receipt: options.receipt || `receipt_${Date.now()}`,
      notes: options.notes || {}
    };
    razorpayDebug('create_order_request', {
      amount: orderOptions.amount,
      currency: orderOptions.currency,
      receipt: orderOptions.receipt,
      notes: orderOptions.notes || null
    });
    const order = await razorpay.orders.create(orderOptions);
    razorpayDebug('create_order_response', {
      orderId: order?.id || null,
      amount: order?.amount || null,
      currency: order?.currency || null,
      status: order?.status || null,
      receipt: order?.receipt || null
    });
    return order;
  } catch (error) {
    logger.error(`Error creating Razorpay order:`, {
      message: error.message,
      error: error.error || error.description || error,
      statusCode: error.statusCode,
      status: error.status,
      options: {
        amount: options.amount,
        currency: options.currency,
        receipt: options.receipt
      },
      stack: error.stack
    });
    razorpayDebug('create_order_error', {
      message: error.message || null,
      description: error?.error?.description || error?.description || null,
      code: error?.error?.code || null,
      reason: error?.error?.reason || null,
      source: error?.error?.source || null,
      step: error?.error?.step || null,
      statusCode: error?.statusCode || null,
      amount: options.amount || null,
      currency: options.currency || null,
      receipt: options.receipt || null
    });

    // Return more descriptive error message
    let errorMessage = 'Failed to create payment order';
    if (error.error && error.error.description) {
      errorMessage = error.error.description;
    } else if (error.message) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

/**
 * Verify Razorpay payment signature
 * @param {String} razorpayOrderId - Razorpay order ID
 * @param {String} razorpayPaymentId - Razorpay payment ID
 * @param {String} razorpaySignature - Razorpay signature
 * @returns {Boolean} True if signature is valid
 */
const verifyPayment = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  const credentials = await getRazorpayCredentials();
  const keySecret = credentials.keySecret;
  if (!keySecret) {
    logger.error('Razorpay key secret not found');
    return false;
  }
  try {
    const generatedSignature = crypto.createHmac('sha256', keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    const isValid = generatedSignature === razorpaySignature;
    if (!isValid) {
      logger.warn('Invalid Razorpay signature', {
        razorpayOrderId,
        razorpayPaymentId,
        providedSignature: razorpaySignature,
        generatedSignature
      });
    }
    return isValid;
  } catch (error) {
    logger.error(`Error verifying Razorpay payment: ${error.message}`);
    return false;
  }
};

/**
 * Fetch payment details from Razorpay
 * @param {String} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
const fetchPayment = async paymentId => {
  const razorpay = await getRazorpayInstance();
  if (!razorpay) {
    throw new Error('Razorpay is not initialized');
  }
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    logger.error(`Error fetching Razorpay payment: ${error.message}`);
    throw error;
  }
};

/**
 * Create a refund
 * @param {String} paymentId - Razorpay payment ID
 * @param {Number} amount - Refund amount in paise (optional, full refund if not provided)
 * @param {String} notes - Refund notes
 * @returns {Promise<Object>} Refund details
 */
const createRefund = async (paymentId, amount = null, notes = {}) => {
  const razorpay = await getRazorpayInstance();
  if (!razorpay) {
    throw new Error('Razorpay is not initialized');
  }
  try {
    if (!paymentId) {
      throw new Error("Payment ID missing for refund");
    }


    const refundOptions = {
      notes: notes
    };
    if (amount !== null && amount !== undefined && amount !== '') {
      refundOptions.amount = amount;
    }
    razorpayDebug('create_refund_request', {
      paymentId,
      amount: refundOptions.amount || null,
      notes: refundOptions.notes || null
    });
    const refundResponse = await razorpay.payments.refund(paymentId, refundOptions);
    razorpayDebug('create_refund_response', {
      paymentId,
      refundId: refundResponse?.id || null,
      status: refundResponse?.status || null,
      amount: refundResponse?.amount || null,
      currency: refundResponse?.currency || null
    });
    return refundResponse;
  } catch (error) {
    logger.error(`Error creating refund: ${error.message}`);
    razorpayDebug('create_refund_error', {
      paymentId,
      message: error.message || null,
      description: error?.error?.description || error?.description || null,
      code: error?.error?.code || null,
      reason: error?.error?.reason || null,
      source: error?.error?.source || null,
      step: error?.error?.step || null,
      statusCode: error?.statusCode || null,
      amount: amount || null
    });
    throw error;
  }
};
export { initializeRazorpay, getRazorpayInstance, createOrder, verifyPayment, fetchPayment, createRefund };
