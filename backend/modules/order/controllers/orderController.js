import Order from '../models/Order.js';
import Payment from '../../payment/models/Payment.js';
import { createOrder as createRazorpayOrder, verifyPayment, fetchPayment } from '../../payment/services/razorpayService.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Zone from '../../admin/models/Zone.js';
import mongoose from 'mongoose';
import winston from 'winston';
import { calculateOrderPricing, calculateDistance } from '../services/orderCalculationService.js';
import { getRazorpayCredentials } from '../../../shared/utils/envService.js';
import { notifyRestaurantNewOrder } from '../services/restaurantNotificationService.js';
import { notifyRestaurantOrderUpdate } from '../services/restaurantNotificationService.js';
import { calculateOrderSettlement } from '../services/orderSettlementService.js';
import { holdEscrow } from '../services/escrowWalletService.js';
import { processCancellationRefund } from '../services/cancellationRefundService.js';
import etaCalculationService from '../services/etaCalculationService.js';
import etaWebSocketService from '../services/etaWebSocketService.js';
import OrderEvent from '../models/OrderEvent.js';
import UserWallet from '../../user/models/UserWallet.js';
import { computeOrderPreparationTimeMinutes } from '../services/preparationTimeService.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
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
    const locale = resolveLocaleFromRequest(req);
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    const {
      items,
      address,
      restaurantId,
      restaurantName,
      customerName,
      customerPhone,
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

    // Find and validate the restaurant (Optimized with lean and selection)
    const restaurant = await Restaurant.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24 ? [{ _id: restaurantId }] : []),
        { restaurantId: restaurantId },
        { slug: restaurantId }
      ]
    }).select('name location deliveryRange isActive').lean();

    if (!restaurant) {
      logger.error('❌ Restaurant not found:', { searchedRestaurantId: restaurantId, searchedRestaurantName: restaurantName });
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    if (!restaurant.isActive) {
      logger.warn('⚠️ Restaurant is inactive:', { restaurantId: restaurant._id, restaurantName: restaurant.name });
      return res.status(403).json({ success: false, message: 'Restaurant is currently inactive' });
    }

    // CRITICAL: Validate restaurant location
    const restaurantLat = restaurant.location?.latitude || restaurant.location?.coordinates?.[1];
    const restaurantLng = restaurant.location?.longitude || restaurant.location?.coordinates?.[0];

    if (!restaurantLat || !restaurantLng) {
      logger.error('❌ Restaurant location not found:', { restaurantId: restaurant._id, restaurantName: restaurant.name });
      return res.status(400).json({ success: false, message: 'Restaurant location is not set. Please contact support.' });
    }

    // Parallelize Zone Validation and Wallet check
    const [restaurantZone, wallet] = await Promise.all([
      Zone.findOne({
        isActive: true,
        boundary: {
          $geoIntersects: {
            $geometry: {
              type: 'Point',
              coordinates: [restaurantLng, restaurantLat]
            }
          }
        }
      }).lean(),
      normalizedPaymentMethod === 'wallet' ? UserWallet.findOne({ userId }).lean() : Promise.resolve(null)
    ]);

    if (!restaurantZone) {
      logger.warn('⚠️ Restaurant location is not within any active zone:', {
        restaurantId: restaurant._id,
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
    const userLat = address.location?.latitude || address.location?.coordinates?.[1];
    const userLng = address.location?.longitude || address.location?.coordinates?.[0];
    if (userLat && userLng) {
      const distance = calculateDistance([restaurantLng, restaurantLat], [userLng, userLat]);
      const maxRange = restaurant.deliveryRange || 5;

      if (distance > maxRange) {
        logger.warn('Order rejected: delivery address beyond restaurant deliveryRange', {
          restaurantId: restaurant._id?.toString(),
          restaurantName: restaurant.name,
          maxRangeKm: maxRange,
          distanceKm: Number(distance.toFixed(2))
        });
        return res.status(403).json({
          success: false,
          code: 'OUT_OF_DELIVERY_RANGE',
          message: 'Out of delivery range. Please update your delivery address or try another restaurant.'
        });
      }
    }

    assignedRestaurantId = restaurant._id.toString();
    assignedRestaurantName = restaurant.name;

    // Generate order ID
    const generatedOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Ensure couponCode is included in pricing
    if (!pricing.couponCode && pricing.appliedCoupon?.code) {
      pricing.couponCode = pricing.appliedCoupon.code;
    }
    if (!pricing.couponSource && pricing.appliedCoupon?.source) {
      pricing.couponSource = pricing.appliedCoupon.source;
    }

    // Calculate pricing (Optimized: pass pre-fetched restaurant)
    const pricingData = await calculateOrderPricing({
      items,
      restaurantId: assignedRestaurantId,
      deliveryAddress: address,
      couponCode: pricing.couponCode,
      deliveryFleet: deliveryFleet || 'standard',
      userId,
      locale,
    });

    // Create the order
    const order = new Order({
      orderId: generatedOrderId,
      // Re-added orderId generation
      userId,
      customerName: String(customerName || '').trim(),
      customerPhone: String(customerPhone || '').replace(/\D/g, '').slice(-10),
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
        isRecommended: item.isRecommended === true
      })),
      address,
      pricing: {
        subtotal: pricingData.subtotal,
        discount: pricingData.discount,
        deliveryFee: pricingData.deliveryFee,
        platformFee: pricingData.platformFee,
        adminDeliveryCost: pricingData.internalAdminDeliveryCost || 0,
        adminDeliveryGst: pricingData.adminDeliveryGst || 0,
        restaurantPayableToAdmin: pricingData.restaurantPayableToAdmin || 0,
        gstCollected: pricingData.gstCollected || pricingData.tax || 0,
        distanceKm: pricingData.distanceKm || 0,
        pricingMeta: pricingData.pricingMeta || null,
        tax: pricingData.tax,
        total: pricingData.total,
        internalRecommendedFee: pricingData.internalRecommendedFee,
        // Track internal fee
        couponCode: pricing.couponCode,
        couponSource: pricing.couponSource || pricingData.appliedCoupon?.source || null
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

    // Compute preparation time server-side from Menu (do not trust client values)
    const prepResult = await computeOrderPreparationTimeMinutes({
      restaurantObjectId: restaurant._id?.toString?.() || assignedRestaurantId,
      items
    });
    order.preparationTime = prepResult.prepMinutes;

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
          userLocation,
          prepTimeMinutes: order.preparationTime
        });

        const finalMinETA = etaResult.minETA;
        const finalMaxETA = etaResult.maxETA;

        // Update order with ETA
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
            preparationTime: order.preparationTime,
            preparationTimeSource: prepResult.source
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

    const buildOrderResponse = () => {
      const etaMin = Number(order?.eta?.min);
      const etaMax = Number(order?.eta?.max);
      const hasEtaRange = Number.isFinite(etaMin) && Number.isFinite(etaMax);
      const estimatedDeliveryTime = Number(order?.estimatedDeliveryTime);

      return {
        id: order._id.toString(),
        orderId: order.orderId,
        status: order.status,
        total: pricingData.total,
        estimatedDeliveryTime: Number.isFinite(estimatedDeliveryTime) ? estimatedDeliveryTime : null,
        eta: hasEtaRange ? {
          min: etaMin,
          max: etaMax,
          formatted: `${etaMin}-${etaMax} mins`
        } : null
      };
    };

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
            order: buildOrderResponse(),
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

      // Notify user about order placement (FCM)
      try {
        const {
          sendNotificationToUser
        } = await import('../../notification/utils/pushNotificationHelper.js');
        await sendNotificationToUser(userId, 'user', 'Order Placed Successfully!', `Your order #${order.orderId} has been placed. Waiting for restaurant to prepare.`, {
          orderId: order.orderId,
          orderMongoId: order._id?.toString(),
          status: order.status,
          type: 'new_order',
          templateKey: 'user_order_placed',
          templateVars: {
            orderId: order.orderId
          }
        });
      } catch (fcmError) {
        logger.error('❌ Error sending FCM notification to user for COD order:', fcmError);
      }

      // Respond to client (no Razorpay details for COD)
      return res.status(201).json({
        success: true,
        data: {
          order: buildOrderResponse(),
          razorpay: null
        }
      });
    }

    // Note: For Razorpay / online payments, restaurant notification is sent
    // from the webhook after payment capture. The frontend verification step
    // only stores gateway identifiers and does not confirm the order.

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
            restaurantId: restaurantId || 'unknown',
            type: 'order_payment'
          }
        });

        // Update order with Razorpay order ID
        order.payment.razorpayOrderId = razorpayOrder.id;
        await order.save();

        try {
          const existingPayment = await Payment.findOne({
            orderId: order._id,
            'razorpay.orderId': razorpayOrder.id
          });

          const paymentPayload = {
            amount: pricingData.total,
            currency: 'INR',
            method: 'razorpay',
            status: 'created',
            razorpay: {
              orderId: razorpayOrder.id,
              receipt: order.orderId,
              notes: {
                orderId: order.orderId,
                userId: userId.toString(),
                restaurantId: restaurantId || 'unknown',
                type: 'order_payment'
              }
            },
            gatewayResponse: razorpayOrder
          };

          if (existingPayment) {
            existingPayment.amount = paymentPayload.amount;
            existingPayment.currency = paymentPayload.currency;
            existingPayment.method = paymentPayload.method;
            existingPayment.status = paymentPayload.status;
            existingPayment.razorpay = {
              ...(existingPayment.razorpay || {}),
              ...paymentPayload.razorpay
            };
            existingPayment.gatewayResponse = paymentPayload.gatewayResponse;
            existingPayment.logs = existingPayment.logs || [];
            existingPayment.logs.push({
              action: 'created',
              timestamp: new Date(),
              details: {
                razorpayOrderId: razorpayOrder.id,
                amount: pricingData.total,
                note: 'Razorpay order created; awaiting webhook'
              },
              ipAddress: req.ip,
              userAgent: req.get('user-agent')
            });
            await existingPayment.save();
          } else {
            await Payment.create({
              paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              orderId: order._id,
              userId,
              ...paymentPayload,
              logs: [{
                action: 'created',
                timestamp: new Date(),
                details: {
                  razorpayOrderId: razorpayOrder.id,
                  amount: pricingData.total,
                  note: 'Razorpay order created; awaiting webhook'
                },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
              }]
            });
          }
        } catch (paymentCreateError) {
          logger.error(`Error creating Razorpay payment record: ${paymentCreateError.message}`);
        }
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
        razorpayKeyId = credentials.keyId || process.env.RAZORPAY_API_KEY;
      } catch (error) {
        logger.warn(`Failed to get Razorpay key ID from env service: ${error.message}`);
        razorpayKeyId = process.env.RAZORPAY_API_KEY;
      }
    }
    res.status(201).json({
      success: true,
      data: {
        order: buildOrderResponse(),
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
 * Verify payment signature only.
 * Final order confirmation is done by the Razorpay webhook after payment.captured.
 */
export const verifyOrderPayment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
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

    const buildVerificationOrderResponse = () => {
      const etaMin = Number(order?.eta?.min);
      const etaMax = Number(order?.eta?.max);
      const hasEtaRange = Number.isFinite(etaMin) && Number.isFinite(etaMax);
      const estimatedDeliveryTime = Number(order?.estimatedDeliveryTime);

      return {
        id: order._id.toString(),
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.payment.status,
        estimatedDeliveryTime: Number.isFinite(estimatedDeliveryTime) ? estimatedDeliveryTime : null,
        eta: hasEtaRange ? {
          min: etaMin,
          max: etaMax,
          formatted: `${etaMin}-${etaMax} mins`
        } : null
      };
    };

    // If payment is already completed, retry restaurant notification if it was missed (idempotent).
    if (String(order.payment?.status || '').toLowerCase().trim() === 'completed') {
      try {
        const notifiedAtMs = order.payment?.restaurantNotifiedAt ? new Date(order.payment.restaurantNotifiedAt).getTime() : 0;
        if (!notifiedAtMs) {
          const restaurantId = order.restaurantId?.toString?.() || order.restaurantId;
          if (restaurantId) {
            const result = await notifyRestaurantNewOrder(order, restaurantId, 'razorpay');
            if (result?.success) {
              order.payment.restaurantNotifiedAt = new Date();
              await order.save();
            }
          }
        }
      } catch (notifyErr) {
        logger.warn('⚠️ verifyOrderPayment: restaurant notify retry failed:', notifyErr?.message || notifyErr);
      }
      return res.json({
        success: true,
        message: 'Payment already completed for this order.',
        data: {
          order: buildVerificationOrderResponse()
        }
      });
    }

    // Verify payment signature
    const isValid = await verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Persist gateway identifiers only.
    // Do not confirm the order here. Webhook remains the source of truth for final status.
    let payment = await Payment.findOne({
      orderId: order._id,
      'razorpay.orderId': razorpayOrderId
    });

    if (!payment) {
      payment = await Payment.create({
        paymentId: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: order._id,
        userId,
        amount: order.pricing.total,
        currency: 'INR',
        method: 'razorpay',
        status: 'created',
        razorpay: {
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature
        },
        gatewayResponse: {
          razorpayOrderId,
          razorpayPaymentId
        },
        logs: [{
          action: 'created',
          timestamp: new Date(),
          details: {
            razorpayOrderId,
            razorpayPaymentId,
            note: 'Signature verified; awaiting webhook confirmation'
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }]
      });
    } else {
      const existingPaymentStatus = String(payment.status || '').toLowerCase().trim();
      const isFinalizedPayment = existingPaymentStatus === 'success' || existingPaymentStatus === 'completed';

      if (!isFinalizedPayment) {
        payment.status = 'created';
      }

      payment.razorpay = {
        ...(payment.razorpay || {}),
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature
      };
      payment.gatewayResponse = {
        ...(payment.gatewayResponse || {}),
        razorpayOrderId,
        razorpayPaymentId
      };
      payment.logs = payment.logs || [];
      payment.logs.push({
        action: 'created',
        timestamp: new Date(),
        details: {
          razorpayOrderId,
          razorpayPaymentId,
          note: isFinalizedPayment
            ? 'Signature verified after capture; preserving finalized payment status'
            : 'Signature verified; awaiting webhook confirmation'
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      await payment.save();
    }

    const orderPaymentStatus = String(order.payment?.status || '').toLowerCase().trim();
    const paymentFinalizedForOrder = String(payment.status || '').toLowerCase().trim() === 'success' || String(payment.status || '').toLowerCase().trim() === 'completed';
    const isOrderPaymentFinalized = orderPaymentStatus === 'completed' || paymentFinalizedForOrder;
    if (!isOrderPaymentFinalized) {
      order.payment.status = 'pending';
    }
    order.payment.method = 'razorpay';
    order.payment.razorpayOrderId = razorpayOrderId || order.payment.razorpayOrderId;
    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.payment.transactionId = razorpayPaymentId;
    await order.save();

    // Fallback: confirm capture from Razorpay and notify restaurant even if webhook is missing.
    let capturedByGateway = false;
    try {
      const gatewayPayment = await fetchPayment(razorpayPaymentId);
      const gatewayStatus = String(gatewayPayment?.status || '').toLowerCase().trim();
      capturedByGateway = gatewayStatus === 'captured';

      if (capturedByGateway) {
        // Upgrade order payment state to completed (webhook-equivalent)
        order.payment.status = 'completed';
        order.payment.method = 'razorpay';
        order.payment.razorpayOrderId = razorpayOrderId || order.payment.razorpayOrderId;
        order.payment.razorpayPaymentId = razorpayPaymentId;
        order.payment.transactionId = razorpayPaymentId;
        await order.save();

        // Update payment record to success (best-effort)
        try {
          await Payment.updateMany(
            { orderId: order._id, method: 'razorpay' },
            {
              $set: {
                status: 'success',
                'razorpay.orderId': razorpayOrderId,
                'razorpay.paymentId': razorpayPaymentId
              },
              $push: {
                logs: {
                  action: 'captured',
                  timestamp: new Date(),
                  details: {
                    razorpayOrderId,
                    razorpayPaymentId,
                    note: 'Capture confirmed via verify-payment fallback (webhook unavailable)'
                  },
                  ipAddress: req.ip,
                  userAgent: req.get('user-agent')
                }
              }
            }
          );
        } catch (paymentUpdateErr) {
          logger.warn('⚠️ verifyOrderPayment: payment record update failed:', paymentUpdateErr?.message || paymentUpdateErr);
        }

        // Settlement + escrow (best-effort)
        try {
          await calculateOrderSettlement(order._id);
          await holdEscrow(order._id, userId, order.pricing?.total || 0);
        } catch (settlementErr) {
          logger.error('❌ verifyOrderPayment fallback settlement/escrow failed:', settlementErr);
        }

        // Notify restaurant once (idempotent)
        try {
          const notifiedAtMs = order.payment?.restaurantNotifiedAt ? new Date(order.payment.restaurantNotifiedAt).getTime() : 0;
          if (!notifiedAtMs) {
            const restaurantId = order.restaurantId?.toString?.() || order.restaurantId;
            if (restaurantId) {
              const result = await notifyRestaurantNewOrder(order, restaurantId, 'razorpay');
              if (result?.success) {
                order.payment.restaurantNotifiedAt = new Date();
                await order.save();
              }
            }
          }
        } catch (notifyErr) {
          logger.warn('⚠️ verifyOrderPayment fallback restaurant notification failed:', notifyErr?.message || notifyErr);
        }
      }
    } catch (gatewayErr) {
      logger.warn('⚠️ verifyOrderPayment: fetchPayment failed; relying on webhook:', gatewayErr?.message || gatewayErr);
    }

    return res.json({
      success: true,
      message: capturedByGateway
        ? 'Payment captured and order confirmed. Restaurant will receive the order now.'
        : 'Payment signature verified. Final confirmation will happen after webhook capture.',
      data: {
        order: buildVerificationOrderResponse(),
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
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('orderId status pricing items address createdAt deliveredAt restaurantName restaurantId estimatedDeliveryTime eta review cancelledBy cancellationReason tracking')
      .populate('restaurantId', 'name slug profileImage address location')
      .lean();
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
    const userId = req.user?._id || req.user?.id;
    const {
      id
    } = req.params;

    // Optimized parallel fetch for order and its payment
    const [order, payment] = await Promise.all([
      (async () => {
        let foundOrder = null;
        if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
          foundOrder = await Order.findOne({ _id: id, userId })
            .select('+deliveryVerification.handoffOtp.code')
            .populate('deliveryPartnerId', 'name email phone')
            .populate('restaurantId', 'name slug address location profileImage')
            .lean();
        }
        if (!foundOrder) {
          foundOrder = await Order.findOne({ orderId: id, userId })
            .select('+deliveryVerification.handoffOtp.code')
            .populate('deliveryPartnerId', 'name email phone')
            .populate('restaurantId', 'name slug address location profileImage')
            .lean();
        }
        return foundOrder;
      })(),
      Payment.findOne({
        $or: [
          { orderId: mongoose.Types.ObjectId.isValid(id) && id.length === 24 ? id : null },
          { paymentId: id } // fallback for some payment-first lookups
        ]
      }).select('-logs').lean()
    ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Attempt second payment lookup by internal MongoDB _id if first failed
    const effectivePayment = payment || await Payment.findOne({ orderId: order._id }).select('-logs').lean();
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
 * Submit user rating/review for a delivered order
 * PATCH /api/order/:id/review
 */
export const submitOrderReview = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const ratingValue = Number(req.body?.rating);
    const reviewTextRaw = req.body?.review ?? req.body?.comment ?? '';
    const reviewText = typeof reviewTextRaw === 'string' ? reviewTextRaw.trim() : '';

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5'
      });
    }

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({ _id: id, userId }).lean();
    }
    if (!order) {
      order = await Order.findOne({ orderId: id, userId }).lean();
    }
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const normalizedStatus = String(order.status || '').toLowerCase();
    const deliveryStateStatus = String(order.deliveryState?.status || '').toLowerCase();
    const isDelivered = normalizedStatus === 'delivered' || normalizedStatus === 'completed' || deliveryStateStatus === 'delivered';
    if (!isDelivered) {
      return res.status(400).json({
        success: false,
        message: 'You can review only delivered orders'
      });
    }

    const updateData = {
      'review.rating': ratingValue,
      'review.submittedAt': new Date(),
      'review.reviewedBy': userId
    };
    if (reviewText) {
      updateData['review.comment'] = reviewText;
    }

    const updatedOrder = await Order.findByIdAndUpdate(order._id, {
      $set: updateData
    }, {
      new: true,
      runValidators: true
    })
      .select('orderId status review deliveredAt')
      .lean();

    return res.json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        order: updatedOrder
      }
    });
  } catch (error) {
    logger.error(`Error submitting order review: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
};

/**
 * Update delivery instructions for a user order
 * PATCH /api/order/:id/delivery-instructions
 */
export const updateDeliveryInstructions = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const rawInstructions = req.body?.deliveryInstructions;
    const deliveryInstructions = typeof rawInstructions === 'string' ? rawInstructions.trim() : '';

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({ _id: id, userId });
    }
    if (!order) {
      order = await Order.findOne({ orderId: id, userId });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (['cancelled', 'delivered'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Delivery instructions can no longer be updated for this order'
      });
    }

    if (!order.address) {
      order.address = {};
    }

    order.address.deliveryInstructions = deliveryInstructions;
    await order.save();

    return res.json({
      success: true,
      message: 'Delivery instructions updated successfully',
      data: {
        deliveryInstructions: order.address.deliveryInstructions || ''
      }
    });
  } catch (error) {
    logger.error(`Error updating delivery instructions: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery instructions'
    });
  }
};

/**
 * Cancel order by user
 * PATCH /api/order/:id/cancel
 */
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
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
    if (order.status === 'ready') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order after preparation is complete'
      });
    }
    if (order.status === 'out_for_delivery') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order once it is out for delivery'
      });
    }
    if (order.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Order is already refunded'
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

    if ((actualPaymentMethod === 'cash' || actualPaymentMethod === 'cod') && order.status === 'preparing') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel COD order once preparation has started'
      });
    }

    // Allow cancellation for all payment methods (Razorpay, COD, Wallet)
    // Only restrict if order is already cancelled or delivered (checked above)

    // Calculate/trigger refund only for online payments (Razorpay) and wallet
    // COD orders don't need refund since payment hasn't been made
    let refundMessage = '';
    if (actualPaymentMethod === 'razorpay') {
      try {
        const {
          initiateRazorpayRefundForOrder
        } = await import('../services/cancellationRefundService.js');

        if (actualPaymentMethod === 'razorpay') {
          const refundResult = await initiateRazorpayRefundForOrder({
            orderId: order._id,
            trigger: 'user',
            reason: reason.trim()
          });

          if (refundResult?.refundQueued) {
            refundMessage = ' Refund queued and will be initiated automatically once payment is captured.';
          } else if (refundResult?.refundInitiated) {
            refundMessage = ` Refund initiated for ${refundResult.policy?.refundPercent || 0}% and final status will be confirmed by Razorpay webhook.`;
          } else if (refundResult?.refundSkipped) {
          refundMessage = ' No refund required as per policy.';
          }

        }
      } catch (refundError) {
        logger.error(`Error calculating cancellation refund for order ${order.orderId}:`, refundError);
        // Don't fail the cancellation if refund calculation fails
      }
    }

    // Update order status
    order.status = 'cancelled';
    order.cancellationReason = reason.trim();
    order.cancelledBy = 'user';
    order.cancelledAt = new Date();
    await order.save();

    try {
      await notifyRestaurantOrderUpdate(order._id.toString(), 'cancelled');
    } catch (notifyError) {
      logger.error(`Error notifying restaurant after cancellation for order ${order.orderId}:`, notifyError);
    }

    if (actualPaymentMethod === 'wallet') {
      try {
        const {
          calculateCancellationRefund
        } = await import('../services/cancellationRefundService.js');
        await calculateCancellationRefund(order._id, reason);
        refundMessage = ' Refund will be processed in wallet flow.';
      } catch (refundError) {
        logger.error(`Error calculating cancellation refund for order ${order.orderId}:`, refundError);
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
    const locale = resolveLocaleFromRequest(req);
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

    const hasUsableCoords = (addr) => {
      if (!addr || typeof addr !== 'object') return false;
      const coords = addr?.location?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) return true;
      }
      const lat = Number(addr?.location?.latitude ?? addr?.latitude);
      const lng = Number(addr?.location?.longitude ?? addr?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    };

    // Get delivery address
    let finalDeliveryAddress = deliveryAddress;

    // If addressId is provided, fetch it from user profile
    if (addressId && req.user && (req.user._id || req.user.id)) {
      try {
        // Dynamic import to avoid circular dependency
        const {
          default: User
        } = await import('../../auth/models/User.js');
        const user = await User.findById(req.user._id || req.user.id);
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

    // Fallback: if address payload lacks usable coordinates, use user's currentLocation coordinates.
    if (!hasUsableCoords(finalDeliveryAddress) && req.user && (req.user._id || req.user.id)) {
      try {
        const { default: User } = await import('../../auth/models/User.js');
        const user = await User.findById(req.user._id || req.user.id).select('currentLocation').lean();
        const c = user?.currentLocation;
        const lat = Number(c?.latitude ?? c?.location?.coordinates?.[1]);
        const lng = Number(c?.longitude ?? c?.location?.coordinates?.[0]);
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
          finalDeliveryAddress = {
            ...(finalDeliveryAddress || {}),
            location: {
              ...(finalDeliveryAddress?.location || {}),
              type: 'Point',
              coordinates: [lng, lat],
              latitude: lat,
              longitude: lng
            },
            latitude: lat,
            longitude: lng
          };
        }
      } catch (err) {
        console.error('Error resolving fallback currentLocation for pricing:', err);
      }
    }

    // Calculate pricing (Note: calculateOrder still fetches restaurant internally if not provided)
    const pricing = await calculateOrderPricing({
      items,
      restaurantId,
      deliveryAddress: finalDeliveryAddress,
      couponCode,
      deliveryFleet: deliveryFleet || 'standard',
      userId: req.user?._id || req.user?.id || null,
      locale,
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
