import Order from '../models/Order.js';
import Payment from '../../payment/models/Payment.js';
import { createOrder as createRazorpayOrder, verifyPayment } from '../../payment/services/razorpayService.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Zone from '../../admin/models/Zone.js';
import mongoose from 'mongoose';
import winston from 'winston';
import { calculateOrderPricing, calculateDistance } from '../services/orderCalculationService.js';
import { getRazorpayCredentials } from '../../../shared/utils/envService.js';
import { notifyRestaurantNewOrder } from '../services/restaurantNotificationService.js';
import { calculateOrderSettlement } from '../services/orderSettlementService.js';
import { holdEscrow } from '../services/escrowWalletService.js';
import { processCancellationRefund } from '../services/cancellationRefundService.js';
import etaCalculationService from '../services/etaCalculationService.js';
import etaWebSocketService from '../services/etaWebSocketService.js';
import OrderEvent from '../models/OrderEvent.js';
import UserWallet from '../../user/models/UserWallet.js';
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

/**
 * Create a new order and initiate Razorpay payment
 */
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      items,
      address,
      restaurantId,
      restaurantName,
      pricing,
      deliveryFleet,
      note,
      sendCutlery,
      paymentMethod: bodyPaymentMethod
    } = req.body;
    // Support both camelCase and snake_case from client
    const paymentMethod = bodyPaymentMethod ?? req.body.payment_method;

    // Normalize payment method: 'cod' / 'COD' / 'Cash on Delivery' → 'cash', 'wallet' → 'wallet'
    const normalizedPaymentMethod = (() => {
      const m = paymentMethod && String(paymentMethod).toLowerCase().trim() || '';
      if (m === 'cash' || m === 'cod' || m === 'cash on delivery') return 'cash';
      if (m === 'wallet') return 'wallet';
      return paymentMethod || 'razorpay';
    })();
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must have at least one item'
      });
    }
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required'
      });
    }
    if (!pricing) {
      return res.status(400).json({
        success: false,
        message: 'Pricing payload is required'
      });
    }

    // Validate and assign restaurant - order goes to the restaurant whose food was ordered
    if (!restaurantId || restaurantId === 'unknown') {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required. Please select a restaurant.'
      });
    }
    let assignedRestaurantId = restaurantId;
    let assignedRestaurantName = restaurantName;

    // Log incoming restaurant data for debugging

    // Find and validate the restaurant
    let restaurant = null;
    // Try to find restaurant by restaurantId, _id, or slug
    if (mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
      restaurant = await Restaurant.findById(restaurantId);
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [{
          restaurantId: restaurantId
        }, {
          slug: restaurantId
        }]
      });
    }
    if (!restaurant) {
      logger.error('❌ Restaurant not found:', {
        searchedRestaurantId: restaurantId,
        searchedRestaurantName: restaurantName
      });
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // CRITICAL: Validate restaurant name matches
    if (restaurantName && restaurant.name !== restaurantName) {
      logger.warn('⚠️ Restaurant name mismatch:', {
        incomingName: restaurantName,
        foundRestaurantName: restaurant.name,
        incomingRestaurantId: restaurantId,
        foundRestaurantId: restaurant._id?.toString() || restaurant.restaurantId
      });
      // Still proceed but log the mismatch
    }

    // Note: Removed isAcceptingOrders check - orders can come even when restaurant is offline
    // Restaurant can accept/reject orders manually, or orders will auto-reject after accept time expires
    // if (!restaurant.isAcceptingOrders) {
    //   logger.warn('⚠️ Restaurant not accepting orders:', {
    //     restaurantId: restaurant._id?.toString() || restaurant.restaurantId,
    //     restaurantName: restaurant.name
    //   });
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Restaurant is currently not accepting orders'
    //   });
    // }

    if (!restaurant.isActive) {
      logger.warn('⚠️ Restaurant is inactive:', {
        restaurantId: restaurant._id?.toString() || restaurant.restaurantId,
        restaurantName: restaurant.name
      });
      return res.status(403).json({
        success: false,
        message: 'Restaurant is currently inactive'
      });
    }

    // CRITICAL: Validate that restaurant's location (pin) is within an active zone
    const restaurantLat = restaurant.location?.latitude || restaurant.location?.coordinates?.[1];
    const restaurantLng = restaurant.location?.longitude || restaurant.location?.coordinates?.[0];
    if (!restaurantLat || !restaurantLng) {
      logger.error('❌ Restaurant location not found:', {
        restaurantId: restaurant._id?.toString() || restaurant.restaurantId,
        restaurantName: restaurant.name
      });
      return res.status(400).json({
        success: false,
        message: 'Restaurant location is not set. Please contact support.'
      });
    }

    // Check if restaurant is within any active zone
    const activeZones = await Zone.find({
      isActive: true
    }).lean();
    let restaurantInZone = false;
    let restaurantZone = null;
    for (const zone of activeZones) {
      if (!zone.coordinates || zone.coordinates.length < 3) continue;
      let isInZone = false;
      if (typeof zone.containsPoint === 'function') {
        isInZone = zone.containsPoint(restaurantLat, restaurantLng);
      } else {
        // Ray casting algorithm
        let inside = false;
        for (let i = 0, j = zone.coordinates.length - 1; i < zone.coordinates.length; j = i++) {
          const coordI = zone.coordinates[i];
          const coordJ = zone.coordinates[j];
          const xi = typeof coordI === 'object' ? coordI.latitude || coordI.lat : null;
          const yi = typeof coordI === 'object' ? coordI.longitude || coordI.lng : null;
          const xj = typeof coordJ === 'object' ? coordJ.latitude || coordJ.lat : null;
          const yj = typeof coordJ === 'object' ? coordJ.longitude || coordJ.lng : null;
          if (xi === null || yi === null || xj === null || yj === null) continue;
          const intersect = yi > restaurantLng !== yj > restaurantLng && restaurantLat < (xj - xi) * (restaurantLng - yi) / (yj - yi) + xi;
          if (intersect) inside = !inside;
        }
        isInZone = inside;
      }
      if (isInZone) {
        restaurantInZone = true;
        restaurantZone = zone;
        break;
      }
    }
    if (!restaurantInZone) {
      logger.warn('⚠️ Restaurant location is not within any active zone:', {
        restaurantId: restaurant._id?.toString() || restaurant.restaurantId,
        restaurantName: restaurant.name,
        restaurantLat,
        restaurantLng
      });
      return res.status(403).json({
        success: false,
        message: 'This restaurant is not available in your area. Only restaurants within active delivery zones can receive orders.'
      });
    }
    // NEW: Calculate distance and validate restaurant's deliveryRange
    // Get user's coordinates from address
    const userLat = address.location?.latitude || address.location?.coordinates?.[1];
    const userLng = address.location?.longitude || address.location?.coordinates?.[0];
    if (userLat && userLng) {
      const distance = calculateDistance([restaurantLng, restaurantLat], [userLng, userLat]);
      const maxRange = restaurant.deliveryRange || 5; // Default 5km if not set

      if (distance > maxRange) {
        return res.status(403).json({
          success: false,
          message: `This restaurant only delivers up to ${maxRange}km. Your location is ${distance.toFixed(1)}km away.`
        });
      }
    }

    // RELAXED: Validate user's zone matches restaurant's zone (Allow cross-zone if within range)
    const {
      zoneId: userZoneId
    } = req.body; // User's zone ID from frontend

    if (userZoneId) {
      const restaurantZoneId = restaurantZone._id.toString();
      if (restaurantZoneId !== userZoneId) {}
    } else {
      logger.warn('⚠️ User zoneId not provided in order request');
    }
    assignedRestaurantId = restaurant._id?.toString() || restaurant.restaurantId;
    assignedRestaurantName = restaurant.name;

    // Log restaurant assignment for debugging

    // Generate order ID before creating order
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const generatedOrderId = `ORD-${timestamp}-${random}`;

    // Ensure couponCode is included in pricing
    if (!pricing.couponCode && pricing.appliedCoupon?.code) {
      pricing.couponCode = pricing.appliedCoupon.code;
    }

    // Calculate pricing including potential internal recommendation fees
    const pricingData = await calculateOrderPricing({
      items,
      restaurantId: assignedRestaurantId,
      deliveryAddress: address,
      couponCode: pricing.couponCode,
      deliveryFleet: deliveryFleet || 'standard'
    });

    // Create the order
    const order = new Order({
      orderId: generatedOrderId,
      // Re-added orderId generation
      userId,
      restaurantId: assignedRestaurantId,
      restaurantName: assignedRestaurantName,
      items: items.map(item => ({
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        description: item.description,
        isVeg: item.isVeg,
        isRecommended: item.isRecommended || false
      })),
      address,
      pricing: {
        subtotal: pricingData.subtotal,
        discount: pricingData.discount,
        deliveryFee: pricingData.deliveryFee,
        platformFee: pricingData.platformFee,
        adminDeliveryCost: pricingData.internalAdminDeliveryCost || 0,
        restaurantPayableToAdmin: pricingData.restaurantPayableToAdmin || 0,
        gstCollected: pricingData.gstCollected || pricingData.tax || 0,
        distanceKm: pricingData.distanceKm || 0,
        pricingMeta: pricingData.pricingMeta || null,
        tax: pricingData.tax,
        total: pricingData.total,
        internalRecommendedFee: pricingData.internalRecommendedFee,
        // Track internal fee
        couponCode: pricing.couponCode
      },
      deliveryFleet: deliveryFleet || 'standard',
      note: note || '',
      sendCutlery: sendCutlery !== false,
      status: 'pending',
      payment: {
        method: normalizedPaymentMethod,
        status: 'pending'
      }
    });

    // Parse preparation time from order items
    // Extract maximum preparation time from items (e.g., "20-25 mins" -> 25)
    let maxPreparationTime = 0;
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        if (item.preparationTime) {
          const prepTimeStr = String(item.preparationTime).trim();
          // Parse formats like "20-25 mins", "20-25", "25 mins", "25"
          const match = prepTimeStr.match(/(\d+)(?:\s*-\s*(\d+))?/);
          if (match) {
            const minTime = parseInt(match[1], 10);
            const maxTime = match[2] ? parseInt(match[2], 10) : minTime;
            maxPreparationTime = Math.max(maxPreparationTime, maxTime);
          }
        }
      });
    }
    order.preparationTime = maxPreparationTime;
    // Calculate initial ETA
    try {
      const restaurantLocation = restaurant.location ? {
        latitude: restaurant.location.latitude,
        longitude: restaurant.location.longitude
      } : null;
      const userLocation = address.location?.coordinates ? {
        latitude: address.location.coordinates[1],
        longitude: address.location.coordinates[0]
      } : null;
      if (restaurantLocation && userLocation) {
        const etaResult = await etaCalculationService.calculateInitialETA({
          restaurantId: assignedRestaurantId,
          restaurantLocation,
          userLocation
        });

        // Add preparation time to ETA (use max preparation time)
        const finalMinETA = etaResult.minETA + maxPreparationTime;
        const finalMaxETA = etaResult.maxETA + maxPreparationTime;

        // Update order with ETA (including preparation time)
        order.eta = {
          min: finalMinETA,
          max: finalMaxETA,
          lastUpdated: new Date(),
          additionalTime: 0 // Will be updated when restaurant adds time
        };
        order.estimatedDeliveryTime = Math.ceil((finalMinETA + finalMaxETA) / 2);

        // Create order created event
        await OrderEvent.create({
          orderId: order._id,
          eventType: 'ORDER_CREATED',
          data: {
            initialETA: {
              min: finalMinETA,
              max: finalMaxETA
            },
            preparationTime: maxPreparationTime
          },
          timestamp: new Date()
        });
      } else {
        logger.warn('⚠️ Could not calculate ETA - missing location data');
      }
    } catch (etaError) {
      logger.error('❌ Error calculating ETA:', etaError);
      // Continue with order creation even if ETA calculation fails
    }
    await order.save();

    // Log order creation for debugging

    // For wallet payments, check balance and deduct before creating order
    if (normalizedPaymentMethod === 'wallet') {
      try {
        // Find or create wallet
        const wallet = await UserWallet.findOrCreateByUserId(userId);

        // Check if sufficient balance
        if (pricingData.total > wallet.balance) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient wallet balance',
            data: {
              required: pricingData.total,
              available: wallet.balance,
              shortfall: pricingData.total - wallet.balance
            }
          });
        }

        // Check if transaction already exists for this order (prevent duplicate)
        const existingTransaction = wallet.transactions.find(t => t.orderId && t.orderId.toString() === order._id.toString() && t.type === 'deduction');
        if (existingTransaction) {
          logger.warn('⚠️ Wallet payment already processed for this order', {
            orderId: order.orderId,
            transactionId: existingTransaction._id
          });
        } else {
        // Deduct money from wallet
          const transaction = wallet.addTransaction({
            amount: pricingData.total,
            type: 'deduction',
            status: 'Completed',
            description: `Order payment - Order #${order.orderId}`,
            orderId: order._id
          });
          await wallet.save();
        }

        // Create payment record
        try {
          const payment = new Payment({
            paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            orderId: order._id,
            userId,
            amount: pricingData.total,
            currency: 'INR',
            method: 'wallet',
            status: 'completed',
            logs: [{
              action: 'completed',
              timestamp: new Date(),
              details: {
                previousStatus: 'new',
                newStatus: 'completed',
                note: 'Wallet payment completed'
              }
            }]
          });
          await payment.save();
        } catch (paymentError) {
          logger.error('❌ Error creating wallet payment record:', paymentError);
        }

        // Mark order as confirmed and payment as completed
        order.payment.method = 'wallet';
        order.payment.status = 'completed';
        order.status = 'pending'; // Keep as pending instead of auto-confirmed
        // order.tracking.confirmed = {
        //   status: true,
        //   timestamp: new Date()
        // };
        await order.save();
        try {
          await calculateOrderSettlement(order._id);
          await holdEscrow(order._id, userId, order.pricing.total);
        } catch (settlementError) {
          logger.error(`Error calculating settlement/escrow for wallet order ${order.orderId}:`, settlementError);
        }

        // Notify restaurant about new wallet payment order
        try {
          const notifyRestaurantResult = await notifyRestaurantNewOrder(order, assignedRestaurantId, 'wallet');
        } catch (notifyError) {
          logger.error('❌ Error notifying restaurant about wallet payment order:', notifyError);
        }

        // Respond to client
        return res.status(201).json({
          success: true,
          data: {
            order: {
              id: order._id.toString(),
              orderId: order.orderId,
              status: order.status,
              total: pricingData.total
            },
            razorpay: null,
            wallet: {
              balance: wallet.balance,
              deducted: pricingData.total
            }
          }
        });
      } catch (walletError) {
        logger.error('❌ Error processing wallet payment:', walletError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process wallet payment',
          error: walletError.message
        });
      }
    }

    // For cash-on-delivery orders, confirm immediately and notify restaurant.
    // Online (Razorpay) orders follow the existing verifyOrderPayment flow.
    if (normalizedPaymentMethod === 'cash') {
      // Best-effort payment record; even if it fails we still proceed with order.
      try {
        const payment = new Payment({
          paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          orderId: order._id,
          userId,
          amount: order.pricing.total,
          currency: 'INR',
          method: 'cash',
          status: 'pending',
          logs: [{
            action: 'pending',
            timestamp: new Date(),
            details: {
              previousStatus: 'new',
              newStatus: 'pending',
              note: 'Cash on delivery order created'
            }
          }]
        });
        await payment.save();
      } catch (paymentError) {
        logger.error('❌ Error creating COD payment record (continuing without blocking order):', {
          error: paymentError.message,
          stack: paymentError.stack
        });
      }

      // Mark order as pending so restaurant must accept it
      order.payment.method = 'cash';
      order.payment.status = 'pending';
      order.status = 'pending';
      // order.tracking.confirmed = {
      //   status: true,
      //   timestamp: new Date()
      // };
      await order.save();
      try {
        await calculateOrderSettlement(order._id);
        await holdEscrow(order._id, userId, order.pricing.total);
      } catch (settlementError) {
        logger.error(`Error calculating settlement/escrow for COD order ${order.orderId}:`, settlementError);
      }

      // Notify restaurant about new COD order via Socket.IO (non-blocking)
      try {
        const notifyRestaurantResult = await notifyRestaurantNewOrder(order, assignedRestaurantId, 'cash');
      } catch (notifyError) {
        logger.error('❌ Error notifying restaurant about COD order (order still created):', {
          error: notifyError.message,
          stack: notifyError.stack
        });
      }

      // Respond to client (no Razorpay details for COD)
      return res.status(201).json({
        success: true,
        data: {
          order: {
            id: order._id.toString(),
            orderId: order.orderId,
            status: order.status,
            total: pricingData.total
          },
          razorpay: null
        }
      });
    }

    // Note: For Razorpay / online payments, restaurant notification will be sent
    // after payment verification in verifyOrderPayment. This ensures restaurant
    // only receives prepaid orders after successful payment.

    // Create Razorpay order for online payments
    let razorpayOrder = null;
    if (normalizedPaymentMethod === 'razorpay' || !normalizedPaymentMethod) {
      try {
        razorpayOrder = await createRazorpayOrder({
          amount: Math.round(pricingData.total * 100),
          // Convert to paise
          currency: 'INR',
          receipt: order.orderId,
          notes: {
            orderId: order.orderId,
            userId: userId.toString(),
            restaurantId: restaurantId || 'unknown'
          }
        });

        // Update order with Razorpay order ID
        order.payment.razorpayOrderId = razorpayOrder.id;
        await order.save();
      } catch (razorpayError) {
        logger.error(`Error creating Razorpay order: ${razorpayError.message}`);
        // Continue with order creation even if Razorpay fails
        // Payment can be handled later
      }
    }
    // Get Razorpay key ID from env service
    let razorpayKeyId = null;
    if (razorpayOrder) {
      try {
        const credentials = await getRazorpayCredentials();
        razorpayKeyId = credentials.keyId || process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY;
      } catch (error) {
        logger.warn(`Failed to get Razorpay key ID from env service: ${error.message}`);
        razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_API_KEY;
      }
    }
    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order._id.toString(),
          orderId: order.orderId,
          status: order.status,
          total: pricingData.total
        },
        razorpay: razorpayOrder ? {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: razorpayKeyId
        } : null
      }
    });
  } catch (error) {
    logger.error(`Error creating order: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify payment and confirm order
 */
export const verifyOrderPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification fields'
      });
    }

    // Find order (support both MongoDB ObjectId and orderId string)
    let order;
    try {
      // Try to find by MongoDB ObjectId first
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findOne({
          _id: orderId,
          userId
        });
      }

      // If not found, try by orderId string
      if (!order) {
        order = await Order.findOne({
          orderId: orderId,
          userId
        });
      }
    } catch (error) {
      // Fallback: try both
      order = await Order.findOne({
        $or: [{
          _id: orderId
        }, {
          orderId: orderId
        }],
        userId
      });
    }
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify payment signature
    const isValid = await verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      // Update order payment status to failed
      order.payment.status = 'failed';
      await order.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Create payment record
    const payment = new Payment({
      paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: order._id,
      userId,
      amount: order.pricing.total,
      currency: 'INR',
      method: 'razorpay',
      status: 'completed',
      razorpay: {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature
      },
      transactionId: razorpayPaymentId,
      completedAt: new Date(),
      logs: [{
        action: 'completed',
        timestamp: new Date(),
        details: {
          razorpayOrderId,
          razorpayPaymentId
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }]
    });
    await payment.save();

    // Update order status - Keep as pending for restaurant to accept
    order.payment.status = 'completed';
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.payment.transactionId = razorpayPaymentId;
    order.status = 'pending'; // Keep as pending instead of confirmed
    // order.tracking.confirmed = { status: true, timestamp: new Date() };
    await order.save();

    // Calculate order settlement and hold escrow
    try {
      // Calculate settlement breakdown
      await calculateOrderSettlement(order._id);

      // Hold funds in escrow
      await holdEscrow(order._id, userId, order.pricing.total);
    } catch (settlementError) {
      logger.error(`❌ Error calculating settlement for order ${order.orderId}:`, settlementError);
      // Don't fail payment verification if settlement calculation fails
      // But log it for investigation
    }

    // Notify restaurant about confirmed order (payment verified)
    try {
      const restaurantId = order.restaurantId?.toString() || order.restaurantId;
      const restaurantName = order.restaurantName;

      // CRITICAL: Log detailed info before notification

      // Verify order has restaurantId before notifying
      if (!restaurantId) {
        logger.error('❌ CRITICAL: Cannot notify restaurant - order.restaurantId is missing!', {
          orderId: order.orderId,
          order: {
            _id: order._id?.toString(),
            restaurantId: order.restaurantId,
            restaurantName: order.restaurantName
          }
        });
        throw new Error('Order restaurantId is missing');
      }

      // Verify order has restaurantName before notifying
      if (!restaurantName) {
        logger.warn('⚠️ Order restaurantName is missing:', {
          orderId: order.orderId,
          restaurantId: restaurantId
        });
      }
      const notificationResult = await notifyRestaurantNewOrder(order, restaurantId);
    } catch (notificationError) {
      logger.error(`❌ CRITICAL: Error notifying restaurant after payment verification:`, {
        error: notificationError.message,
        stack: notificationError.stack,
        orderId: order.orderId,
        orderMongoId: order._id?.toString(),
        restaurantId: order.restaurantId,
        restaurantName: order.restaurantName,
        orderStatus: order.status
      });
      // Don't fail payment verification if notification fails
      // Order is still saved and restaurant can fetch it via API
      // But log it as critical for debugging
    }
    res.json({
      success: true,
      data: {
        order: {
          id: order._id.toString(),
          orderId: order.orderId,
          status: order.status
        },
        payment: {
          id: payment._id.toString(),
          paymentId: payment.paymentId,
          status: payment.status
        }
      }
    });
  } catch (error) {
    logger.error(`Error verifying order payment: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user orders
 */
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const {
      status,
      limit = 20,
      page = 1
    } = req.query;
    if (!userId) {
      logger.error('User ID not found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Build query - MongoDB should handle string/ObjectId conversion automatically
    // But we'll try both formats to be safe
    const mongoose = (await import('mongoose')).default;
    const query = {
      userId
    };

    // If userId is a string that looks like ObjectId, also try ObjectId format
    if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
      query.$or = [{
        userId: userId
      }, {
        userId: new mongoose.Types.ObjectId(userId)
      }];
      delete query.userId; // Remove direct userId since we're using $or
    }

    // Add status filter if provided
    if (status) {
      if (query.$or) {
        // Add status to each $or condition
        query.$or = query.$or.map(condition => ({
          ...condition,
          status
        }));
      } else {
        query.status = status;
      }
    }
    if (status) {
      query.status = status;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query).sort({
      createdAt: -1
    }).limit(parseInt(limit)).skip(skip).select('-__v').populate('restaurantId', 'name slug profileImage address location phone ownerPhone').populate('userId', 'name phone email').lean();
    const total = await Order.countDocuments(query);
    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error(`Error fetching user orders: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
};

/**
 * Get order details
 */
export const getOrderDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      id
    } = req.params;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        userId
      }).populate('deliveryPartnerId', 'name email phone').populate('userId', 'name fullName phone email').lean();
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        userId
      }).populate('deliveryPartnerId', 'name email phone').populate('userId', 'name fullName phone email').lean();
    }
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get payment details
    const payment = await Payment.findOne({
      orderId: order._id
    }).lean();
    res.json({
      success: true,
      data: {
        order,
        payment
      }
    });
  } catch (error) {
    logger.error(`Error fetching order details: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    });
  }
};

/**
 * Cancel order by user
 * PATCH /api/order/:id/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      id
    } = req.params;
    const {
      reason
    } = req.body;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    // Find order by MongoDB _id or orderId
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        userId
      });
    }
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        userId
      });
    }
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled'
      });
    }
    if (order.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a delivered order'
      });
    }

    // Get payment method from order or payment record
    const paymentMethod = order.payment?.method;
    const payment = await Payment.findOne({
      orderId: order._id
    });
    const paymentMethodFromPayment = payment?.method || payment?.paymentMethod;

    // Determine the actual payment method
    const actualPaymentMethod = paymentMethod || paymentMethodFromPayment;

    // Allow cancellation for all payment methods (Razorpay, COD, Wallet)
    // Only restrict if order is already cancelled or delivered (checked above)

    // Update order status
    order.status = 'cancelled';
    order.cancellationReason = reason.trim();
    order.cancelledBy = 'user';
    order.cancelledAt = new Date();
    await order.save();

    // Calculate refund amount only for online payments (Razorpay) and wallet
    // COD orders don't need refund since payment hasn't been made
    let refundMessage = '';
    if (actualPaymentMethod === 'razorpay' || actualPaymentMethod === 'wallet') {
      try {
        const {
          calculateCancellationRefund
        } = await import('../services/cancellationRefundService.js');
        await calculateCancellationRefund(order._id, reason);
        refundMessage = ' Refund will be processed after admin approval.';
      } catch (refundError) {
        logger.error(`Error calculating cancellation refund for order ${order.orderId}:`, refundError);
        // Don't fail the cancellation if refund calculation fails
      }
    } else if (actualPaymentMethod === 'cash') {
      refundMessage = ' No refund required as payment was not made.';
    }
    res.json({
      success: true,
      message: `Order cancelled successfully.${refundMessage}`,
      data: {
        order: {
          orderId: order.orderId,
          status: order.status,
          cancellationReason: order.cancellationReason,
          cancelledAt: order.cancelledAt
        }
      }
    });
  } catch (error) {
    logger.error(`Error cancelling order: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order'
    });
  }
};

/**
 * Calculate order pricing
 */
export const calculateOrder = async (req, res) => {
  try {
    const {
      items,
      restaurantId,
      deliveryAddress,
      addressId,
      couponCode,
      deliveryFleet
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must have at least one item'
      });
    }

    // Get delivery address
    let finalDeliveryAddress = deliveryAddress;

    // If addressId is provided, fetch it from user profile
    if (addressId && req.user && req.user.id) {
      try {
        // Dynamic import to avoid circular dependency
        const {
          default: User
        } = await import('../../auth/models/User.js');
        const user = await User.findById(req.user.id);
        if (user && user.addresses) {
          const foundAddress = user.addresses.id(addressId);
          if (foundAddress) {
            finalDeliveryAddress = foundAddress.toObject();
          }
        }
      } catch (err) {
        console.error('Error fetching user address:', err);
      }
    }

    // Calculate pricing
    const pricing = await calculateOrderPricing({
      items,
      restaurantId,
      deliveryAddress: finalDeliveryAddress,
      couponCode,
      deliveryFleet: deliveryFleet || 'standard'
    });
    res.json({
      success: true,
      data: {
        pricing
      }
    });
  } catch (error) {
    logger.error(`Error calculating order pricing: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate order pricing',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};