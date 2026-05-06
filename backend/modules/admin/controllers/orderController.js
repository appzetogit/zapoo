import Order from '../../order/models/Order.js';
import Refund from '../../refund/models/Refund.js';
import { calculateOrderSettlement } from '../../order/services/orderSettlementService.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';

/**
 * Get all orders for admin
 * GET /api/admin/orders
 * Query params: status, page, limit, search, fromDate, toDate, restaurant, paymentStatus
 */
export const getOrders = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 50,
      search,
      fromDate,
      toDate,
      restaurant,
      paymentStatus,
      zone,
      customer,
      cancelledBy,
      paymentType
    } = req.query;
    const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizedStatus = status ? String(status).toLowerCase() : null;

    // Build query
    const query = {};
    let refundedOrderIds = null;

    // Status filter
    if (status && status !== 'all') {
      if (normalizedStatus === 'offline-payments') {
        query['payment.method'] = {
          $in: ['cash', 'cod']
        };
      } else {
        // Map frontend status keys to backend status values
        const statusMap = {
          'scheduled': 'scheduled',
          'pending': 'pending',
          'accepted': 'confirmed',
          'food-on-the-way': 'out_for_delivery',
          'delivered': 'delivered',
          'canceled': 'cancelled',
          'cancelled': 'cancelled',
          'refunded': 'refunded'
        };

        if (normalizedStatus === 'processing') {
          // Keep support for both historical and current processing values.
          query.status = {
            $in: ['preparing', 'processing']
          };
        } else if (normalizedStatus === 'restaurant-cancelled') {
          query.status = 'cancelled';
          query.cancelledBy = 'restaurant';
        } else if (normalizedStatus === 'payment-failed') {
          // Payment-failed orders are stored with failed order/payment status.
          query.status = 'failed';
        } else if (normalizedStatus === 'refunded') {
          // Razorpay-confirmed refunds only.
          // We intentionally trust Refund.status='success' rather than cancellation/initiation states.
          const successfulRefunds = await Refund.find({
            status: 'success',
            orderId: { $exists: true, $ne: null }
          })
            .select('orderId')
            .lean();

          refundedOrderIds = [
            ...new Set(
              successfulRefunds
                .map((refund) => refund.orderId?.toString())
                .filter(Boolean)
            )
          ];

          // If no successful refunds exist, make query return empty set deterministically.
          query._id = refundedOrderIds.length > 0
            ? { $in: refundedOrderIds.map((id) => new mongoose.Types.ObjectId(id)) }
            : { $in: [] };
        } else {
          const mappedStatus = statusMap[normalizedStatus] || normalizedStatus;
          query.status = mappedStatus;
        }
      }
    }

    // Also handle cancelledBy query parameter (if passed separately)
    if (cancelledBy === 'restaurant') {
      query.status = 'cancelled';
      query.cancelledBy = 'restaurant';
    }

    // Payment status filter
    if (paymentStatus) {
      query['payment.status'] = paymentStatus.toLowerCase();
    }

    if (paymentType) {
      const normalizedPaymentType = String(paymentType).toLowerCase();
      if (normalizedPaymentType === 'cod' || normalizedPaymentType === 'cash') {
        query['payment.method'] = {
          $in: ['cash', 'cod']
        };
      } else if (normalizedPaymentType === 'wallet') {
        query['payment.method'] = 'wallet';
      } else if (normalizedPaymentType === 'online') {
        query['payment.method'] = {
          $nin: ['cash', 'cod', 'wallet']
        };
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Restaurant filter
    if (restaurant && restaurant !== 'All restaurants') {
      // Try to find restaurant by name or ID
      const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
      const restaurantDoc = await Restaurant.findOne({
        $or: [{
          name: {
            $regex: restaurant,
            $options: 'i'
          }
        }, {
          _id: mongoose.Types.ObjectId.isValid(restaurant) ? restaurant : null
        }, {
          restaurantId: restaurant
        }]
      }).select('_id restaurantId').lean();
      if (restaurantDoc) {
        query.restaurantId = restaurantDoc._id?.toString() || restaurantDoc.restaurantId;
      }
    }

    // Zone filter
    if (zone && zone !== 'All Zones') {
      const Zone = (await import('../models/Zone.js')).default;
      const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
      const safeZonePattern = escapeRegex(zone);
      const zoneDoc = await Zone.findOne({
        $or: [{
          name: {
            $regex: safeZonePattern,
            $options: 'i'
          }
        }, {
          zoneName: {
            $regex: safeZonePattern,
            $options: 'i'
          }
        }]
      }).select('_id name zoneName').lean();

      const zoneFilters = [];
      if (zoneDoc?._id) {
        const zoneIdString = zoneDoc._id?.toString();
        zoneFilters.push({ 'assignmentInfo.zoneId': zoneIdString });
        zoneFilters.push({ 'assignmentInfo.zoneId': zoneDoc._id });

        const zoneRestaurants = await Restaurant.find({
          zoneId: zoneDoc._id
        }).select('_id restaurantId').lean();

        const restaurantIdentifiers = [
          ...new Set(
            zoneRestaurants.flatMap((restaurant) => [
              restaurant?._id ? restaurant._id.toString() : null,
              restaurant?.restaurantId || null
            ]).filter(Boolean)
          )
        ];

        if (restaurantIdentifiers.length > 0) {
          zoneFilters.push({ restaurantId: { $in: restaurantIdentifiers } });
        }
      }
      zoneFilters.push({
        'assignmentInfo.zoneName': {
          $regex: safeZonePattern,
          $options: 'i'
        }
      });

      if (zoneFilters.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({ $or: zoneFilters });
      }
    }

    // Customer filter
    if (customer && customer !== 'All customers') {
      const User = (await import('../../auth/models/User.js')).default;
      const userDoc = await User.findOne({
        name: {
          $regex: customer,
          $options: 'i'
        }
      }).select('_id').lean();
      if (userDoc) {
        query.userId = userDoc._id;
      }
    }

    // Search filter (orderId, customer name, customer phone)
    if (search) {
      query.$or = [{
        orderId: {
          $regex: search,
          $options: 'i'
        }
      }];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = {
          phone: {
            $regex: cleanSearch,
            $options: 'i'
          }
        };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          query.$or.push({
            userId: {
              $in: userIds
            }
          });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: {
          $regex: search,
          $options: 'i'
        }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        if (!query.$or) query.$or = [];
        query.$or.push({
          userId: {
            $in: userIdsByName
          }
        });
      }

      // Ensure $or array is not empty
      if (query.$or && query.$or.length === 0) {
        delete query.$or;
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with population
    const orders = await Order.find(query).populate('userId', 'name email phone').populate('restaurantId', 'name slug').populate('deliveryPartnerId', 'name phone').sort({
      createdAt: -1
    }).limit(parseInt(limit)).skip(skip).lean();

    // Get total count
    const total = await Order.countDocuments(query);

    // Batch fetch settlements for platform fee and refund status (more efficient than individual queries)
    let settlementMap = new Map();
    let refundStatusMap = new Map();
    let refundAmountMap = new Map();
    let refundIdsMap = new Map();
    let settlementCouponMap = new Map();
    try {
      const OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
      const orderIds = orders.map(o => o._id);
      const settlements = await OrderSettlement.find({
        orderId: {
          $in: orderIds
        }
      }).select('orderId userPayment.platformFee cancellationDetails.refundStatus adminCouponDiscount restaurantCouponDiscount couponDiscount').lean();

      // Create maps for quick lookup
      settlements.forEach(s => {
        if (s.orderId) {
          if (s.userPayment?.platformFee !== undefined) {
            settlementMap.set(s.orderId.toString(), s.userPayment.platformFee);
          }
          if (s.cancellationDetails?.refundStatus) {
            refundStatusMap.set(s.orderId.toString(), s.cancellationDetails.refundStatus);
          }
          settlementCouponMap.set(s.orderId.toString(), s);
        }
      });
    } catch (err) {
      console.warn('Could not batch fetch settlements:', err.message);
    }

    // For refunded tab, enrich rows using only gateway-confirmed refunds (status=success).
    if (normalizedStatus === 'refunded' && orders.length > 0) {
      try {
        const orderIds = orders.map((o) => o._id);
        const successfulRefunds = await Refund.find({
          status: 'success',
          orderId: { $in: orderIds }
        })
          .select('orderId amount refundId')
          .lean();

        const refundAmountAccumulator = new Map();
        successfulRefunds.forEach((refund) => {
          const orderId = refund.orderId?.toString();
          if (!orderId) return;

          const amount = Number(refund.amount || 0);
          refundAmountAccumulator.set(orderId, (refundAmountAccumulator.get(orderId) || 0) + amount);

          if (!refundIdsMap.has(orderId)) {
            refundIdsMap.set(orderId, []);
          }
          refundIdsMap.get(orderId).push(refund.refundId);
          refundStatusMap.set(orderId, 'processed');
        });

        refundAmountAccumulator.forEach((amount, orderId) => {
          refundAmountMap.set(orderId, Math.round(amount * 100) / 100);
        });

      } catch (err) {
        console.warn('Could not fetch successful refund metadata:', err.message);
      }
    }

    // Fallback lookup: infer coupon source by coupon code when source is missing.
    const unresolvedCouponCodes = [
      ...new Set(
        orders
          .map((order) => {
            const hasDiscount = Number(order.pricing?.discount || 0) > 0;
            const rawCode = String(order.pricing?.couponCode || '').trim();
            const hasSource = order.pricing?.couponSource === 'admin' || order.pricing?.couponSource === 'restaurant';
            const settlementCoupon = settlementCouponMap.get(order._id.toString());
            const hasSettlementSplit =
              Number(settlementCoupon?.adminCouponDiscount || 0) > 0 ||
              Number(settlementCoupon?.restaurantCouponDiscount || 0) > 0;

            if (!hasDiscount || !rawCode || hasSource || hasSettlementSplit) return null;
            return rawCode.toUpperCase();
          })
          .filter(Boolean)
      )
    ];

    let restaurantCouponCodeSet = new Set();
    let adminCouponCodeSet = new Set();
    if (unresolvedCouponCodes.length > 0) {
      const Offer = (await import('../../restaurant/models/Offer.js')).default;
      const AdminCoupon = (await import('../models/AdminCoupon.js')).default;

      const [offers, adminCoupons] = await Promise.all([
        Offer.find({
          'items.couponCode': { $in: unresolvedCouponCodes }
        }).select('items.couponCode').lean(),
        AdminCoupon.find({
          code: { $in: unresolvedCouponCodes }
        }).select('code').lean()
      ]);

      restaurantCouponCodeSet = new Set(
        offers
          .flatMap((offer) => offer.items || [])
          .map((item) => String(item?.couponCode || '').trim().toUpperCase())
          .filter(Boolean)
      );
      adminCouponCodeSet = new Set(
        adminCoupons
          .map((coupon) => String(coupon?.code || '').trim().toUpperCase())
          .filter(Boolean)
      );
    }

    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (unmasked - show full number for admin)
      const customerPhone = order.userId?.phone || '';

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Pending',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };
      const paymentStatusDisplay = paymentStatusMap[order.payment?.status] || 'Pending';

      // Map order status for display
      // Check if cancelled and determine who cancelled it
      let orderStatusDisplay;
      if (normalizedStatus === 'refunded') {
        orderStatusDisplay = 'Refunded';
      } else if (order.status === 'cancelled') {
        // Check cancelledBy field to determine who cancelled
        if (order.cancelledBy === 'restaurant') {
          orderStatusDisplay = 'Cancelled by Restaurant';
        } else if (order.cancelledBy === 'user') {
          orderStatusDisplay = 'Cancelled by User';
        } else {
          // Fallback: check cancellation reason pattern for old orders
          const cancellationReason = order.cancellationReason || '';
          const isRestaurantCancelled = /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i.test(cancellationReason);
          orderStatusDisplay = isRestaurantCancelled ? 'Cancelled by Restaurant' : 'Cancelled by User';
        }
      } else {
        const statusMap = {
          'pending': 'Pending',
          'confirmed': 'Accepted',
          'preparing': 'Processing',
          'ready': 'Ready',
          'out_for_delivery': 'Food On The Way',
          'delivered': 'Delivered',
          'scheduled': 'Scheduled'
        };
        orderStatusDisplay = statusMap[order.status] || order.status;
      }

      // Determine delivery type
      const deliveryType = order.deliveryFleet === 'standard' ? 'Home Delivery' : order.deliveryFleet === 'fast' ? 'Fast Delivery' : 'Home Delivery';

      // Calculate report-specific fields
      const subtotal = order.pricing?.subtotal || 0;
      const discount = order.pricing?.discount || 0;
      const deliveryFee = order.pricing?.deliveryFee || 0;
      const tax = order.pricing?.tax || 0;
      const settlementCoupon = settlementCouponMap.get(order._id.toString());

      let couponSource = order.pricing?.couponSource === 'admin' ?
        'admin' :
        order.pricing?.couponSource === 'restaurant' ?
          'restaurant' :
          null;
      const normalizedCouponCode = String(order.pricing?.couponCode || '').trim().toUpperCase();
      if (!couponSource && normalizedCouponCode) {
        if (restaurantCouponCodeSet.has(normalizedCouponCode)) {
          couponSource = 'restaurant';
        } else if (adminCouponCodeSet.has(normalizedCouponCode)) {
          couponSource = 'admin';
        }
      }

      // Get platform fee - check if it exists in pricing, otherwise get from settlement map
      let platformFee = order.pricing?.platformFee;
      if (platformFee === undefined || platformFee === null) {
        // Get from settlement map (batch fetched above)
        platformFee = settlementMap.get(order._id.toString());

        // If still not found, calculate from total (fallback for old orders)
        if (platformFee === undefined || platformFee === null) {
          const calculatedTotal = (order.pricing?.subtotal || 0) - (order.pricing?.discount || 0) + (order.pricing?.deliveryFee || 0) + (order.pricing?.tax || 0);
          const actualTotal = order.pricing?.total || 0;
          const difference = actualTotal - calculatedTotal;
          // If difference is positive and reasonable (between 0 and 50), assume it's platform fee
          platformFee = difference > 0 && difference <= 50 ? difference : 0;
        }
      }

      // For report: itemDiscount is the discount applied to items
      const itemDiscount = discount;
      // Discounted amount is subtotal after discount
      const discountedAmount = Math.max(0, subtotal - discount);
      // Coupon discounts split by source
      const adminCouponDiscount = settlementCoupon?.adminCouponDiscount ?? (couponSource === 'admin' ? discount : 0);
      const restaurantCouponDiscount = settlementCoupon?.restaurantCouponDiscount ?? (couponSource === 'restaurant' ? discount : 0);
      const couponDiscount = adminCouponDiscount + restaurantCouponDiscount;
      // Referral discount (not currently in model, default to 0)
      const referralDiscount = 0;
      // GST
      const gst = tax;
      // Delivery charge
      const deliveryCharge = deliveryFee;
      // Total item amount (subtotal before discounts)
      const totalItemAmount = subtotal;
      // Order amount (final total)
      const orderAmount = order.pricing?.total || 0;
      return {
        sl: skip + index + 1,
        orderId: order.orderId,
        id: order._id.toString(),
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: customerPhone,
        customerEmail: order.userId?.email || '',
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        // Report-specific fields
        totalItemAmount: totalItemAmount,
        itemDiscount: itemDiscount,
        adminCouponDiscount: adminCouponDiscount,
        restaurantCouponDiscount: restaurantCouponDiscount,
        discountedAmount: discountedAmount,
        couponDiscount: couponDiscount,
        couponSource: couponSource,
        referralDiscount: referralDiscount,
        gst: gst,
        vatTax: gst,
        deliveryCharge: deliveryCharge,
        platformFee: platformFee,
        totalAmount: orderAmount,
        // Original fields
        paymentStatus: paymentStatusDisplay,
        paymentType: (() => {
          const paymentMethod = order.payment?.method;
          if (paymentMethod === 'cash' || paymentMethod === 'cod') {
            return 'Cash on Delivery';
          } else if (paymentMethod === 'wallet') {
            return 'Wallet';
          } else {
            return 'Online';
          }
        })(),
        paymentCollectionStatus: order.payment?.method === 'cash' || order.payment?.method === 'cod' ? order.status === 'delivered' ? 'Collected' : 'Not Collected' : 'Collected',
        orderStatus: orderStatusDisplay,
        status: order.status,
        // Backend status
        deliveryType: deliveryType,
        items: order.items || [],
        address: order.address || {},
        deliveryPartnerName: order.deliveryPartnerId?.name || null,
        deliveryPartnerPhone: order.deliveryPartnerId?.phone || null,
        estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
        deliveredAt: order.deliveredAt,
        cancellationReason: order.cancellationReason || null,
        cancelledAt: order.cancelledAt || null,
        cancelledBy: order.cancelledBy || null,
        tracking: order.tracking || {},
        deliveryState: order.deliveryState || {},
        billImageUrl: order.billImageUrl || null,
        // Bill image captured by delivery boy
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Zone info from assignmentInfo
        zoneId: order.assignmentInfo?.zoneId || null,
        zoneName: order.assignmentInfo?.zoneName || null,
        // Refund status from settlement
        refundStatus: refundStatusMap.get(order._id.toString()) || null,
        refundedAmount: refundAmountMap.get(order._id.toString()) || 0,
        refundIds: refundIdsMap.get(order._id.toString()) || []
      };
    });
    return successResponse(res, 200, 'Orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return errorResponse(res, 500, 'Failed to fetch orders');
  }
});

/**
 * Get order by ID for admin
 * GET /api/admin/orders/:id
 */
export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    let order = null;

    // Try MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findById(id).populate('userId', 'name email phone').populate('restaurantId', 'name slug location address phone').populate('deliveryPartnerId', 'name phone availability').lean();
    }

    // If not found, try by orderId
    if (!order) {
      order = await Order.findOne({
        orderId: id
      }).populate('userId', 'name email phone').populate('restaurantId', 'name slug location address phone').populate('deliveryPartnerId', 'name phone availability').lean();
    }
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }
    return successResponse(res, 200, 'Order retrieved successfully', {
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return errorResponse(res, 500, 'Failed to fetch order');
  }
});

/**
 * Get orders searching for deliveryman (ready orders without delivery partner)
 * GET /api/admin/orders/searching-deliveryman
 * Query params: page, limit, search
 */
export const getSearchingDeliverymanOrders = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search
    } = req.query;
    // Build base conditions for orders that are ready but don't have delivery partner assigned
    // deliveryPartnerId is ObjectId, so we only check for null or missing
    const baseConditions = {
      status: {
        $in: ['ready', 'preparing']
      },
      $or: [{
        deliveryPartnerId: {
          $exists: false
        }
      }, {
        deliveryPartnerId: null
      }]
    };

    // Build search conditions if search is provided
    let searchConditions = null;
    if (search) {
      const searchOrConditions = [{
        orderId: {
          $regex: search,
          $options: 'i'
        }
      }];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = {
          phone: {
            $regex: cleanSearch,
            $options: 'i'
          }
        };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          searchOrConditions.push({
            userId: {
              $in: userIds
            }
          });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: {
          $regex: search,
          $options: 'i'
        }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        searchOrConditions.push({
          userId: {
            $in: userIdsByName
          }
        });
      }
      if (searchOrConditions.length > 0) {
        searchConditions = {
          $or: searchOrConditions
        };
      }
    }

    // Combine all conditions
    const finalQuery = searchConditions ? {
      $and: [baseConditions, searchConditions]
    } : baseConditions;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // Fetch orders with population and strict projection to exclude heavy fields
    const orders = await Order.find(finalQuery)
      .populate('userId', 'name email phone')
      .populate('restaurantId', 'name slug')
      .select('-deliveryState.routeToPickup -deliveryState.routeToDelivery -address.location.coordinates')
      .sort({
        createdAt: -1
      }).limit(parseInt(limit)).skip(skip).lean();

    // Get total count
    const total = await Order.countDocuments(finalQuery);
    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (masked for display)
      const customerPhone = order.userId?.phone || '';
      let maskedPhone = '';
      if (customerPhone && customerPhone.length > 2) {
        maskedPhone = `+${customerPhone.slice(0, 1)}${'*'.repeat(Math.max(0, customerPhone.length - 2))}${customerPhone.slice(-1)}`;
      } else if (customerPhone) {
        maskedPhone = customerPhone; // If too short, show as is
      }

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Unpaid',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };
      const paymentStatusDisplay = paymentStatusMap[order.payment?.status] || 'Unpaid';

      // Map order status for display
      const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Accepted',
        'preparing': 'Pending',
        'ready': 'Pending',
        'out_for_delivery': 'Food On The Way',
        'delivered': 'Delivered',
        'cancelled': 'Canceled',
        'scheduled': 'Scheduled'
      };
      const orderStatusDisplay = statusMap[order.status] || 'Pending';

      // Determine delivery type
      const deliveryType = order.deliveryFleet === 'standard' ? 'Home Delivery' : order.deliveryFleet === 'fast' ? 'Fast Delivery' : 'Home Delivery';

      // Format total amount
      const totalAmount = order.pricing?.total || 0;
      const formattedTotal = `$ ${totalAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
      return {
        id: order.orderId || order._id.toString(),
        sl: skip + index + 1,
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: maskedPhone,
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        total: formattedTotal,
        paymentStatus: paymentStatusDisplay,
        orderStatus: orderStatusDisplay,
        deliveryType: deliveryType,
        // Additional fields for view order dialog
        orderId: order.orderId,
        _id: order._id.toString(),
        customerEmail: order.userId?.email || '',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        items: order.items || [],
        address: order.address || {},
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        pricing: order.pricing || {}
      };
    });
    return successResponse(res, 200, 'Searching deliveryman orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching searching deliveryman orders:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch searching deliveryman orders');
  }
});

/**
 * Get ongoing orders (orders with delivery partner assigned but not delivered)
 * GET /api/admin/orders/ongoing
 * Query params: page, limit, search
 */
export const getOngoingOrders = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search
    } = req.query;
    // Build base conditions for ongoing orders
    // Orders that have deliveryPartnerId assigned but are not delivered/cancelled
    const baseConditions = {
      deliveryPartnerId: {
        $exists: true,
        $ne: null
      },
      status: {
        $nin: ['delivered', 'cancelled']
      }
    };

    // Build search conditions if search is provided
    let searchConditions = null;
    if (search) {
      const searchOrConditions = [{
        orderId: {
          $regex: search,
          $options: 'i'
        }
      }];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = {
          phone: {
            $regex: cleanSearch,
            $options: 'i'
          }
        };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          searchOrConditions.push({
            userId: {
              $in: userIds
            }
          });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: {
          $regex: search,
          $options: 'i'
        }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        searchOrConditions.push({
          userId: {
            $in: userIdsByName
          }
        });
      }
      if (searchOrConditions.length > 0) {
        searchConditions = {
          $or: searchOrConditions
        };
      }
    }

    // Combine all conditions
    const finalQuery = searchConditions ? {
      $and: [baseConditions, searchConditions]
    } : baseConditions;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // Fetch orders with population and strict projection
    const orders = await Order.find(finalQuery)
      .populate('userId', 'name email phone')
      .populate('restaurantId', 'name slug')
      .populate('deliveryPartnerId', 'name phone')
      .select('-deliveryState.routeToPickup -deliveryState.routeToDelivery -address.location.coordinates')
      .sort({
        createdAt: -1
      }).limit(parseInt(limit)).skip(skip).lean();

    // Get total count
    const total = await Order.countDocuments(finalQuery);
    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (masked for display)
      const customerPhone = order.userId?.phone || '';
      let maskedPhone = '';
      if (customerPhone && customerPhone.length > 2) {
        maskedPhone = `+${customerPhone.slice(0, 1)}${'*'.repeat(Math.max(0, customerPhone.length - 2))}${customerPhone.slice(-1)}`;
      } else if (customerPhone) {
        maskedPhone = customerPhone; // If too short, show as is
      }

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Unpaid',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };
      const paymentStatusDisplay = paymentStatusMap[order.payment?.status] || 'Unpaid';

      // Map order status for display with colors
      const statusMap = {
        'pending': {
          text: 'Pending',
          color: 'bg-gray-100 text-gray-600'
        },
        'confirmed': {
          text: 'Confirmed',
          color: 'bg-blue-50 text-blue-600'
        },
        'preparing': {
          text: 'Preparing',
          color: 'bg-yellow-50 text-yellow-600'
        },
        'ready': {
          text: 'Ready',
          color: 'bg-green-50 text-green-600'
        },
        'out_for_delivery': {
          text: 'Out For Delivery',
          color: 'bg-orange-100 text-orange-600'
        },
        'delivered': {
          text: 'Delivered',
          color: 'bg-green-100 text-green-600'
        },
        'cancelled': {
          text: 'Cancelled',
          color: 'bg-red-50 text-red-600'
        },
        'scheduled': {
          text: 'Scheduled',
          color: 'bg-purple-50 text-purple-600'
        },
      };

      // Check for handover status (when delivery partner has reached pickup)
      let orderStatusDisplay = statusMap[order.status]?.text || 'Pending';
      let orderStatusColor = statusMap[order.status]?.color || 'bg-gray-100 text-gray-600';

      // If delivery partner has reached pickup, show as "Handover"
      if (order.deliveryState?.currentPhase === 'at_pickup' || order.deliveryState?.currentPhase === 'en_route_to_delivery' || order.deliveryState?.currentPhase === 'at_delivery') {
        orderStatusDisplay = 'Handover';
        orderStatusColor = 'bg-blue-50 text-blue-600';
      }

      // Determine delivery type
      const deliveryType = order.deliveryFleet === 'standard' ? 'Home Delivery' : order.deliveryFleet === 'fast' ? 'Fast Delivery' : 'Home Delivery';

      // Format total amount
      const totalAmount = order.pricing?.total || 0;
      const formattedTotal = `$ ${totalAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
      return {
        id: order.orderId || order._id.toString(),
        sl: skip + index + 1,
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: maskedPhone,
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        total: formattedTotal,
        paymentStatus: paymentStatusDisplay,
        orderStatus: orderStatusDisplay,
        orderStatusColor: orderStatusColor,
        deliveryType: deliveryType,
        // Additional fields for view order dialog
        orderId: order.orderId,
        _id: order._id.toString(),
        customerEmail: order.userId?.email || '',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        items: order.items || [],
        address: order.address || {},
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        pricing: order.pricing || {},
        deliveryPartnerName: order.deliveryPartnerId?.name || null,
        deliveryPartnerPhone: order.deliveryPartnerId?.phone || null
      };
    });
    return successResponse(res, 200, 'Ongoing orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching ongoing orders:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch ongoing orders');
  }
});

/**
 * Get transaction report with summary statistics and order transactions
 * GET /api/admin/orders/transaction-report
 * Query params: page, limit, search, zone, restaurant, fromDate, toDate
 */
export const getTransactionReport = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      zone,
      restaurant,
      fromDate,
      toDate
    } = req.query;

    const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Build query for orders
    const query = {};

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Restaurant filter
    if (restaurant && restaurant !== 'All restaurants') {
      const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
      const restaurantDoc = await Restaurant.findOne({
        $or: [{
          name: {
            $regex: restaurant,
            $options: 'i'
          }
        }, {
          _id: mongoose.Types.ObjectId.isValid(restaurant) ? restaurant : null
        }, {
          restaurantId: restaurant
        }]
      }).select('_id restaurantId').lean();
      if (restaurantDoc) {
        query.restaurantId = restaurantDoc._id?.toString() || restaurantDoc.restaurantId;
      }
    }

    // Zone filter
    if (zone && zone !== 'All Zones') {
      const Zone = (await import('../models/Zone.js')).default;
      const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
      const safeZonePattern = escapeRegex(zone);
      const zoneDoc = await Zone.findOne({
        name: {
          $regex: safeZonePattern,
          $options: 'i'
        }
      }).select('_id name').lean();

      // Support both old and new order snapshots:
      // - assignmentInfo.zoneId (preferred)
      // - assignmentInfo.zoneName (legacy/fallback)
      // - restaurantId belonging to selected zone (for historical orders without assignmentInfo)
      const zoneFilters = [];
      if (zoneDoc?._id) {
        const zoneIdString = zoneDoc._id?.toString();

        zoneFilters.push({ 'assignmentInfo.zoneId': zoneIdString });
        zoneFilters.push({ 'assignmentInfo.zoneId': zoneDoc._id });

        const zoneRestaurants = await Restaurant.find({
          zoneId: zoneDoc._id
        }).select('_id restaurantId').lean();

        const restaurantIdentifiers = [
          ...new Set(
            zoneRestaurants.flatMap((restaurant) => [
              restaurant?._id ? restaurant._id.toString() : null,
              restaurant?.restaurantId || null
            ]).filter(Boolean)
          )
        ];

        if (restaurantIdentifiers.length > 0) {
          zoneFilters.push({ restaurantId: { $in: restaurantIdentifiers } });
        }
      }
      zoneFilters.push({
        'assignmentInfo.zoneName': {
          $regex: safeZonePattern,
          $options: 'i'
        }
      });

      if (zoneFilters.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({ $or: zoneFilters });
      }
    }

    // Search filter (orderId)
    if (search) {
      query.orderId = {
        $regex: search,
        $options: 'i'
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with population
    const orders = await Order.find(query).populate('userId', 'name email phone').populate('restaurantId', 'name slug').sort({
      createdAt: -1
    }).limit(parseInt(limit)).skip(skip).lean();

    // Fetch settlement coupon split for better discount source accuracy
    const orderIds = orders.map(order => order._id);
    const OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
    const settlements = await OrderSettlement.find({
      orderId: { $in: orderIds }
    }).select('orderId adminCouponDiscount restaurantCouponDiscount couponDiscount').lean();
    const settlementCouponMap = new Map(
      settlements.map((settlement) => [settlement.orderId?.toString(), settlement])
    );

    // Fallback lookup: infer coupon source by coupon code when source is missing in order/settlement
    const unresolvedCouponCodes = [
      ...new Set(
        orders
          .map((order) => {
            const hasDiscount = Number(order.pricing?.discount || 0) > 0;
            const rawCode = String(order.pricing?.couponCode || '').trim();
            const hasSource = order.pricing?.couponSource === 'admin' || order.pricing?.couponSource === 'restaurant';
            const settlementCoupon = settlementCouponMap.get(order._id.toString());
            const hasSettlementSplit =
              Number(settlementCoupon?.adminCouponDiscount || 0) > 0 ||
              Number(settlementCoupon?.restaurantCouponDiscount || 0) > 0;

            if (!hasDiscount || !rawCode || hasSource || hasSettlementSplit) return null;
            return rawCode.toUpperCase();
          })
          .filter(Boolean)
      )
    ];

    let restaurantCouponCodeSet = new Set();
    let adminCouponCodeSet = new Set();
    if (unresolvedCouponCodes.length > 0) {
      const Offer = (await import('../../restaurant/models/Offer.js')).default;
      const AdminCoupon = (await import('../models/AdminCoupon.js')).default;

      const [offers, adminCoupons] = await Promise.all([
        Offer.find({
          'items.couponCode': { $in: unresolvedCouponCodes }
        }).select('items.couponCode').lean(),
        AdminCoupon.find({
          code: { $in: unresolvedCouponCodes }
        }).select('code').lean()
      ]);

      restaurantCouponCodeSet = new Set(
        offers
          .flatMap((offer) => offer.items || [])
          .map((item) => String(item?.couponCode || '').trim().toUpperCase())
          .filter(Boolean)
      );
      adminCouponCodeSet = new Set(
        adminCoupons
          .map((coupon) => String(coupon?.code || '').trim().toUpperCase())
          .filter(Boolean)
      );
    }

    // Get total count
    const total = await Order.countDocuments(query);

    // Calculate summary statistics
    const AdminCommission = (await import('../models/AdminCommission.js')).default;

    // Build date query for summary stats
    const summaryDateQuery = {};
    if (fromDate || toDate) {
      summaryDateQuery.orderDate = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        summaryDateQuery.orderDate.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        summaryDateQuery.orderDate.$lte = endDate;
      }
    }

    // Build restaurant filter for summary
    let summaryRestaurantQuery = {};
    if (restaurant && restaurant !== 'All restaurants') {
      const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
      const restaurantDoc = await Restaurant.findOne({
        $or: [{
          name: {
            $regex: restaurant,
            $options: 'i'
          }
        }, {
          _id: mongoose.Types.ObjectId.isValid(restaurant) ? restaurant : null
        }, {
          restaurantId: restaurant
        }]
      }).select('_id restaurantId').lean();
      if (restaurantDoc) {
        summaryRestaurantQuery.restaurantId = restaurantDoc._id || restaurantDoc.restaurantId;
      }
    }

    // Get all orders for summary calculation (without pagination)
    const summaryQuery = {
      ...query
    };
    const allOrdersForSummary = await Order.find(summaryQuery).populate('userId', 'name').populate('restaurantId', 'name').lean();

    // Calculate completed transactions (delivered orders)
    const completedOrders = allOrdersForSummary.filter(order => order.status === 'delivered' && order.payment?.status === 'completed');
    const completedTransaction = completedOrders.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);

    // Calculate refunded transactions
    const refundedOrders = allOrdersForSummary.filter(order => order.status === 'refunded' || order.status === 'cancelled');
    const refundedTransaction = refundedOrders.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);

    // Calculate recommended item fees from orders
    const totalRecommendedFee = completedOrders.reduce((sum, order) => sum + (order.pricing?.internalRecommendedFee || 0), 0);

    // Get admin earning from AdminCommission
    const adminCommissionQuery = {
      status: 'completed',
      ...summaryDateQuery,
      ...summaryRestaurantQuery
    };
    const adminCommissions = await AdminCommission.find(adminCommissionQuery).lean();
    const adminEarning = adminCommissions.reduce((sum, comm) => sum + (comm.commissionAmount || 0), 0);

    // Calculate restaurant earning (order total - admin commission - delivery commission)
    // For simplicity, we'll use restaurantEarning from AdminCommission if available
    const restaurantEarning = adminCommissions.reduce((sum, comm) => sum + (comm.restaurantEarning || 0), 0);

    // Calculate deliveryman earning (from delivery commissions)
    // This would need to be calculated from delivery wallet transactions or order assignment info
    // For now, we'll estimate based on delivery fee or use a placeholder
    const deliverymanEarning = completedOrders.reduce((sum, order) => {
      // Delivery commission is typically calculated from distance
      // For now, we'll use a simple estimate or fetch from delivery wallet
      return sum + (order.pricing?.deliveryFee || 0) * 0.8; // Estimate 80% of delivery fee goes to deliveryman
    }, 0);

    // Transform orders to match frontend format
    const transformedTransactions = orders.map((order, index) => {
      const subtotal = order.pricing?.subtotal || 0;
      const discount = order.pricing?.discount || 0;
      const deliveryFee = order.pricing?.deliveryFee || 0;
      const tax = order.pricing?.tax || 0;
      let couponSource = order.pricing?.couponSource === 'admin'
        ? 'admin'
        : order.pricing?.couponSource === 'restaurant'
          ? 'restaurant'
          : null;
      const settlementCoupon = settlementCouponMap.get(order._id.toString());
      const normalizedCouponCode = String(order.pricing?.couponCode || '').trim().toUpperCase();
      if (!couponSource && normalizedCouponCode) {
        if (restaurantCouponCodeSet.has(normalizedCouponCode)) {
          couponSource = 'restaurant';
        } else if (adminCouponCodeSet.has(normalizedCouponCode)) {
          couponSource = 'admin';
        }
      }

      // For report: itemDiscount is the discount applied to items
      const itemDiscount = discount;
      // Discounted amount is subtotal after discount
      const discountedAmount = Math.max(0, subtotal - discount);
      // Coupon discounts split by source
      const adminCouponDiscount = settlementCoupon?.adminCouponDiscount ?? (couponSource === 'admin' ? discount : 0);
      const restaurantCouponDiscount = settlementCoupon?.restaurantCouponDiscount ?? (couponSource === 'restaurant' ? discount : 0);
      const couponDiscount = adminCouponDiscount + restaurantCouponDiscount;
      // Referral discount (not currently in model, default to 0)
      const referralDiscount = 0;
      // GST
      const gst = tax;
      // Delivery charge
      const deliveryCharge = deliveryFee;
      // Total item amount (subtotal before discounts)
      const totalItemAmount = subtotal;
      // Order amount (final total)
      const orderAmount = order.pricing?.total || 0;
      return {
        id: order._id.toString(),
        orderId: order.orderId,
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        customerName: order.userId?.name || 'Invalid Customer Data',
        totalItemAmount: totalItemAmount,
        itemDiscount: itemDiscount,
        adminCouponDiscount: adminCouponDiscount,
        restaurantCouponDiscount: restaurantCouponDiscount,
        couponDiscount: couponDiscount,
        couponSource: couponSource,
        referralDiscount: referralDiscount,
        discountedAmount: discountedAmount,
        gst: gst,
        vatTax: gst,
        deliveryCharge: deliveryCharge,
        orderAmount: orderAmount,
        recommendedItemFee: order.pricing?.internalRecommendedFee || 0
      };
    });
    return successResponse(res, 200, 'Transaction report retrieved successfully', {
      summary: {
        completedTransaction,
        refundedTransaction,
        adminEarning,
        restaurantEarning,
        deliverymanEarning,
        recommendedItemFee: totalRecommendedFee
      },
      transactions: transformedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching transaction report:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch transaction report');
  }
});

/**
 * Get restaurant report with statistics for each restaurant
 * GET /api/admin/orders/restaurant-report
 * Query params: zone, all (active/inactive), type (commission/subscription), time, search
 */
export const getRestaurantReport = asyncHandler(async (req, res) => {
  try {
    const {
      zone,
      all,
      time,
      search
    } = req.query;
    const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
    const AdminCommission = (await import('../models/AdminCommission.js')).default;
    const FeedbackExperience = (await import('../models/FeedbackExperience.js')).default;

    // Build restaurant query
    const restaurantQuery = {};
    const restaurantAndFilters = [];

    // Zone filter
    if (zone && zone !== 'All Zones') {
      const Zone = (await import('../models/Zone.js')).default;
      const safeZonePattern = escapeRegex(zone);
      const zoneDoc = await Zone.findOne({
        $or: [{
          name: {
            $regex: safeZonePattern,
            $options: 'i'
          }
        }, {
          zoneName: {
            $regex: safeZonePattern,
            $options: 'i'
          }
        }]
      }).select('_id name zoneName').lean();
      if (zoneDoc) {
        const zoneIdString = zoneDoc._id.toString();

        const ordersInZone = await Order.find({
          $or: [{
            'assignmentInfo.zoneId': zoneIdString
          }, {
            'assignmentInfo.zoneId': zoneDoc._id
          }, {
            'assignmentInfo.zoneName': {
              $regex: safeZonePattern,
              $options: 'i'
            }
          }]
        }).distinct('restaurantId').lean();

        const normalizedRestaurantIdsFromOrders = [
          ...new Set(
            (ordersInZone || [])
              .map((id) => id?.toString?.() || String(id))
              .filter(Boolean)
          )
        ];

        const zoneRestaurantOrFilters = [{
          zoneId: zoneDoc._id
        }, {
          zoneId: zoneIdString
        }];

        if (normalizedRestaurantIdsFromOrders.length > 0) {
          const objectIdsFromOrders = normalizedRestaurantIdsFromOrders
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id));

          if (objectIdsFromOrders.length > 0) {
            zoneRestaurantOrFilters.push({
              _id: {
                $in: objectIdsFromOrders
              }
            });
          }

          zoneRestaurantOrFilters.push({
            restaurantId: {
              $in: normalizedRestaurantIdsFromOrders
            }
          });
        }

        restaurantAndFilters.push({
          $or: zoneRestaurantOrFilters
        });
      } else {
        return successResponse(res, 200, 'Restaurant report retrieved successfully', {
          restaurants: [],
          pagination: {
            page: 1,
            limit: 1000,
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Active/Inactive filter
    if (all && all !== 'All') {
      restaurantQuery.isActive = all === 'Active';
    }

    // Search filter
    if (search) {
      const safeSearchPattern = escapeRegex(search);
      restaurantAndFilters.push({
        $or: [{
        name: {
          $regex: safeSearchPattern,
          $options: 'i'
        }
      }, {
        restaurantId: {
          $regex: safeSearchPattern,
          $options: 'i'
        }
      }]
      });
    }

    if (restaurantAndFilters.length > 0) {
      restaurantQuery.$and = restaurantAndFilters;
    }

    // Get all restaurants matching the query
    const restaurants = await Restaurant.find(restaurantQuery).select('_id restaurantId name profileImage rating totalRatings isActive createdAt zoneId').lean();
    // Date range filter for orders
    let dateQuery = {};
    if (time && time !== 'All Time') {
      const now = new Date();
      dateQuery.createdAt = {};
      if (time === 'Today') {
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek;
        const startDate = new Date(now.getFullYear(), now.getMonth(), diff);
        const endDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Month') {
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Year') {
        const startDate = new Date(now.getFullYear(), 0, 1);
        const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      }
    }

    const restaurantObjectIds = restaurants.map((restaurant) =>
      restaurant._id instanceof mongoose.Types.ObjectId
        ? restaurant._id
        : new mongoose.Types.ObjectId(restaurant._id)
    );

    const restaurantKeyByIdentifier = new Map();
    restaurants.forEach((restaurant) => {
      const canonicalId = restaurant._id?.toString();
      if (!canonicalId) return;
      restaurantKeyByIdentifier.set(canonicalId, canonicalId);
      if (restaurant.restaurantId) {
        restaurantKeyByIdentifier.set(restaurant.restaurantId, canonicalId);
      }
    });

    const orderIdentifiers = [
      ...restaurantObjectIds,
      ...restaurantObjectIds.map((id) => id.toString()),
      ...restaurants.map((restaurant) => restaurant.restaurantId).filter(Boolean)
    ];
    const [orders, commissionAgg, ratingAgg] = await Promise.all([
      Order.find({
        ...dateQuery,
        restaurantId: { $in: orderIdentifiers }
      })
        .select('restaurantId pricing.total pricing.discount pricing.tax items.itemId')
        .lean(),
      AdminCommission.aggregate([
        {
          $match: {
            restaurantId: { $in: restaurantObjectIds },
            status: 'completed',
            ...(dateQuery.createdAt ? { orderDate: dateQuery.createdAt } : {})
          }
        },
        {
          $group: {
            _id: '$restaurantId',
            totalAdminCommission: { $sum: '$commissionAmount' }
          }
        }
      ]),
      FeedbackExperience.aggregate([
        {
          $match: {
            restaurantId: { $in: restaurantObjectIds },
            rating: {
              $exists: true,
              $ne: null,
              $gt: 0
            }
          }
        },
        {
          $group: {
            _id: '$restaurantId',
            averageRating: { $avg: '$rating' },
            totalRatings: { $sum: 1 }
          }
        }
      ])
    ]);

    const orderStatsByRestaurant = new Map();
    for (const order of orders) {
      const orderRestaurantId = order.restaurantId?.toString?.() || String(order.restaurantId || '');
      const canonicalId = restaurantKeyByIdentifier.get(orderRestaurantId);
      if (!canonicalId) continue;

      const stats = orderStatsByRestaurant.get(canonicalId) || {
        totalOrder: 0,
        totalOrderAmount: 0,
        totalDiscountGiven: 0,
        totalVATTAX: 0,
        uniqueItemIds: new Set()
      };

      stats.totalOrder += 1;
      stats.totalOrderAmount += order.pricing?.total || 0;
      stats.totalDiscountGiven += order.pricing?.discount || 0;
      stats.totalVATTAX += order.pricing?.tax || 0;

      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          if (item?.itemId) {
            stats.uniqueItemIds.add(item.itemId);
          }
        }
      }

      orderStatsByRestaurant.set(canonicalId, stats);
    }

    const commissionByRestaurant = new Map(
      commissionAgg.map((entry) => [entry._id?.toString(), entry.totalAdminCommission || 0])
    );
    const ratingsByRestaurant = new Map(
      ratingAgg.map((entry) => [
        entry._id?.toString(),
        {
          averageRating: entry.averageRating || 0,
          totalRatings: entry.totalRatings || 0
        }
      ])
    );

    const formatCurrency = (amount) => `₹${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    const restaurantReports = restaurants.map((restaurant) => {
      const restaurantId = restaurant._id?.toString();
      const orderStats = orderStatsByRestaurant.get(restaurantId) || {
        totalOrder: 0,
        totalOrderAmount: 0,
        totalDiscountGiven: 0,
        totalVATTAX: 0,
        uniqueItemIds: new Set()
      };
      const ratingStats = ratingsByRestaurant.get(restaurantId);
      const averageRatings = ratingStats?.averageRating || restaurant.rating || 0;
      const reviews = ratingStats?.totalRatings || restaurant.totalRatings || 0;

      return {
        sl: 0,
        id: restaurantId,
        createdAt: restaurant.createdAt || null,
        restaurantName: restaurant.name,
        icon: restaurant.profileImage?.url || restaurant.profileImage || null,
        totalFood: orderStats.uniqueItemIds.size,
        totalOrder: orderStats.totalOrder,
        totalOrderAmount: formatCurrency(orderStats.totalOrderAmount),
        totalDiscountGiven: formatCurrency(orderStats.totalDiscountGiven),
        totalAdminCommission: formatCurrency(commissionByRestaurant.get(restaurantId) || 0),
        totalVATTAX: formatCurrency(orderStats.totalVATTAX),
        averageRatings: parseFloat(averageRatings.toFixed(1)),
        reviews
      };
    });

    let filteredReports = restaurantReports;

    // Show newest restaurants first
    filteredReports.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Add serial numbers
    filteredReports = filteredReports.map((report, index) => {
      const { createdAt, ...rest } = report;
      return {
        ...rest,
        sl: index + 1
      };
    });
    return successResponse(res, 200, 'Restaurant report retrieved successfully', {
      restaurants: filteredReports,
      pagination: {
        page: 1,
        limit: 1000,
        total: filteredReports.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error('❌ Error fetching restaurant report:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch restaurant report');
  }
});

/**
 * Get refund requests (restaurant cancelled orders with pending refunds)
 * GET /api/admin/refund-requests
 */
export const getRefundRequests = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      fromDate,
      toDate,
      restaurant
    } = req.query;
    // Build query for restaurant cancelled orders with pending refunds
    const query = {
      status: 'cancelled',
      cancellationReason: {
        $regex: /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i
      }
    };
    // Restaurant filter
    if (restaurant && restaurant !== 'All restaurants') {
      try {
        const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
        const restaurantDoc = await Restaurant.findOne({
          $or: [{
            name: {
              $regex: restaurant,
              $options: 'i'
            }
          }, ...(mongoose.Types.ObjectId.isValid(restaurant) ? [{
            _id: restaurant
          }] : []), {
            restaurantId: restaurant
          }]
        }).select('_id restaurantId').lean();
        if (restaurantDoc) {
          query.restaurantId = restaurantDoc._id?.toString() || restaurantDoc.restaurantId;
        }
      } catch (error) {
        console.error('Error filtering by restaurant:', error);
        // Continue without restaurant filter if there's an error
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      query.cancelledAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.cancelledAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.cancelledAt.$lte = endDate;
      }
    }

    // Search filter - build search conditions separately
    const searchConditions = [];
    if (search) {
      searchConditions.push({
        orderId: {
          $regex: search,
          $options: 'i'
        }
      }, {
        restaurantName: {
          $regex: search,
          $options: 'i'
        }
      });
    }

    // Combine search with existing query
    if (searchConditions.length > 0) {
      if (Object.keys(query).length > 0 && !query.$and) {
        // Convert existing query to $and format
        const existingQuery = {
          ...query
        };
        query = {
          $and: [existingQuery, {
            $or: searchConditions
          }]
        };
      } else if (query.$and) {
        // Add search to existing $and
        query.$and.push({
          $or: searchConditions
        });
      } else {
        // Simple case - just add $or
        query.$or = searchConditions;
      }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with population
    // Sort by cancelledAt if available, otherwise by createdAt
    let orders = [];
    try {
      orders = await Order.find(query).populate('userId', 'name email phone').populate({
        path: 'restaurantId',
        select: 'name slug',
        match: {
          _id: {
            $exists: true
          }
        } // Only populate if it's a valid ObjectId
      }).sort({
        cancelledAt: -1,
        createdAt: -1
      }).limit(parseInt(limit)).skip(skip).lean();

      // Filter out orders where restaurantId population failed (null)
      orders = orders.filter(order => order.restaurantId !== null || order.restaurantName);
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
    const total = await Order.countDocuments(query);
    // Get settlement info for each order to check refund status
    let OrderSettlement;
    try {
      OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
    } catch (error) {
      console.error('Error importing OrderSettlement:', error);
      OrderSettlement = null;
    }
    const transformedOrders = await Promise.all(orders.map(async (order, index) => {
      let settlement = null;
      if (OrderSettlement) {
        try {
          settlement = await OrderSettlement.findOne({
            orderId: order._id
          }).lean();
        } catch (error) {
          console.error(`Error fetching settlement for order ${order._id}:`, error);
        }
      }
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();
      const customerPhone = order.userId?.phone || '';

      // Check refund status from settlement
      const refundStatus = settlement?.cancellationDetails?.refundStatus || 'pending';
      const refundAmount = settlement?.cancellationDetails?.refundAmount || 0;
      return {
        sl: skip + index + 1,
        orderId: order.orderId,
        id: order._id.toString(),
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: customerPhone,
        customerEmail: order.userId?.email || '',
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        totalAmount: order.pricing?.total || 0,
        paymentStatus: order.payment?.status === 'completed' ? 'Paid' : 'Pending',
        orderStatus: 'Refund Requested',
        deliveryType: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Fast Delivery',
        cancellationReason: order.cancellationReason || 'Rejected by restaurant',
        cancelledAt: order.cancelledAt,
        refundStatus: refundStatus,
        refundAmount: refundAmount,
        settlement: settlement ? {
          cancellationStage: settlement.cancellationDetails?.cancellationStage,
          refundAmount: settlement.cancellationDetails?.refundAmount,
          restaurantCompensation: settlement.cancellationDetails?.restaurantCompensation
        } : null
      };
    }));
    return successResponse(res, 200, 'Refund requests retrieved successfully', {
      orders: transformedOrders || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: Math.ceil((total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching refund requests:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return errorResponse(res, 500, error.message || 'Failed to fetch refund requests');
  }
});

/**
 * Process refund for an order via Razorpay
 * POST /api/admin/orders/:orderId/refund
 */
export const processRefund = asyncHandler(async (req, res) => {
  try {
    const {
      orderId
    } = req.params;
    const {
      notes,
      refundAmount
    } = req.body;
    const adminId = req.user?.id || req.admin?.id || null;
    // Find order in database - try both MongoDB _id and orderId string
    let order = null;
    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId).populate('userId', 'name email phone _id').lean();
    }

    // If not found by _id, try orderId string
    if (!order) {
      order = await Order.findOne({
        orderId: orderId
      }).populate('userId', 'name email phone _id').lean();
    }
    if (!order) {
      console.error('❌ [processRefund] Order NOT FOUND in database');
      console.error('❌ [processRefund] Searched by:', {
        mongoId: mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24 ? orderId : 'N/A',
        orderIdString: orderId,
        orderIdType: typeof orderId,
        orderIdLength: orderId?.length
      });

      // Try to find any order with similar orderId (for debugging)
      try {
        const similarOrders = await Order.find({
          $or: [{
            orderId: {
              $regex: orderId,
              $options: 'i'
            }
          }, {
            orderId: {
              $regex: orderId.substring(0, 10),
              $options: 'i'
            }
          }]
        }).select('_id orderId status').limit(5).lean();
        if (similarOrders.length > 0) { }
      } catch (debugError) {
        console.error('Error searching for similar orders:', debugError.message);
      }

      // Check total orders count
      try {
        const totalOrders = await Order.countDocuments();
      } catch (countError) {
        console.error('Error counting orders:', countError.message);
      }
      return errorResponse(res, 404, `Order not found (ID: ${orderId}). Please check if the order exists.`);
    }

    // Verify order exists and log complete details

    if (order.status !== 'cancelled') {
      return errorResponse(res, 400, 'Order is not cancelled');
    }

    // Check if it's a cancelled order (by restaurant or user)
    const isRestaurantCancelled = order.cancelledBy === 'restaurant' || order.cancellationReason && /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i.test(order.cancellationReason);
    const isUserCancelled = order.cancelledBy === 'user';
    if (!isRestaurantCancelled && !isUserCancelled) {
      return errorResponse(res, 400, 'This order was not cancelled by restaurant or user');
    }

    // Check payment method - wallet payments don't use Razorpay
    const paymentMethod = order.payment?.method;
    if (!paymentMethod) {
      return errorResponse(res, 400, 'Payment method not found for this order');
    }

    // For wallet payments, allow refund regardless of delivery type (no Razorpay involved)
    // For other payments (Razorpay), only allow refund for Home Delivery orders
    // Note: Order model uses deliveryFleet, not deliveryType
    if (paymentMethod !== 'wallet') {
      // Check deliveryFleet - 'standard' and 'fast' are home delivery types
      const isHomeDelivery = order.deliveryFleet === 'standard' || order.deliveryFleet === 'fast';
      if (!isHomeDelivery) {
        return errorResponse(res, 400, 'Refund can only be processed for Home Delivery orders');
      }
    }

    // Get settlement if it exists. Refund logic can now proceed without it for Razorpay.
    const OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
    let settlement = await OrderSettlement.findOne({
      orderId: order._id
    });

    // For wallet payments, if settlement doesn't exist, reuse the canonical settlement calculator
    if (!settlement && paymentMethod === 'wallet') {
      try {
        await calculateOrderSettlement(order._id);
      } catch (settlementErr) {
        console.error('Error calculating source-aware settlement for wallet refund:', settlementErr.message);
      }
      settlement = await OrderSettlement.findOne({
        orderId: order._id
      });
      if (!settlement) {
        return errorResponse(res, 500, 'Unable to build settlement for wallet refund');
      }
    }

    // Check if refund already processed
    if (settlement?.cancellationDetails?.refundStatus === 'processed' || settlement?.cancellationDetails?.refundStatus === 'initiated') {
      return errorResponse(res, 400, 'Refund already processed or initiated for this order');
    }

    // Handle wallet refunds differently (paymentMethod already declared above)
    // Wallet payments don't use Razorpay - refund is direct wallet credit
    let refundResult;
    if (paymentMethod === 'wallet') {
      // For wallet payments, use provided refundAmount or calculate from order
      const orderTotal = order.pricing?.total || settlement.userPayment?.total || 0;
      let finalRefundAmount = 0;

      // If refundAmount is provided in request body, use it (validate it)
      if (refundAmount !== undefined && refundAmount !== null && refundAmount !== '') {
        const requestedAmount = parseFloat(refundAmount);
        if (isNaN(requestedAmount) || requestedAmount <= 0) {
          console.error('❌ [processRefund] Invalid refund amount:', requestedAmount);
          return errorResponse(res, 400, `Invalid refund amount provided: ${refundAmount}. Please provide a valid positive number.`);
        }
        if (requestedAmount > orderTotal) {
          console.error('❌ [processRefund] Refund amount exceeds order total:', {
            requestedAmount,
            orderTotal
          });
          return errorResponse(res, 400, `Refund amount (₹${requestedAmount}) cannot exceed order total (₹${orderTotal})`);
        }
        finalRefundAmount = requestedAmount;
      } else {
        // If no amount provided, use calculated refund or order total
        const calculatedRefund = settlement.cancellationDetails?.refundAmount || 0;

        // For wallet, always use order total if calculated refund is 0
        if (calculatedRefund <= 0 && orderTotal > 0) {
          finalRefundAmount = orderTotal;
        } else if (calculatedRefund > 0) {
          finalRefundAmount = calculatedRefund;
        } else {
          return errorResponse(res, 400, 'No refund amount found for this order');
        }
      }

      // Update settlement with refund amount
      if (!settlement.cancellationDetails) {
        settlement.cancellationDetails = {};
      }
      settlement.cancellationDetails.refundAmount = finalRefundAmount;
      await settlement.save();

      // Process wallet refund (add to user wallet) with the specified amount
      const {
        processWalletRefund
      } = await import('../../order/services/cancellationRefundService.js');
      refundResult = await processWalletRefund(order._id, adminId, finalRefundAmount);
    } else {
      // Process Razorpay refund
      const {
        processRazorpayRefund
      } = await import('../../order/services/cancellationRefundService.js');
      refundResult = await processRazorpayRefund(order._id, adminId);
    }

    // Update settlement with admin notes if provided
    if (notes && settlement) {
      settlement.metadata = settlement.metadata || new Map();
      settlement.metadata.set('adminRefundNotes', notes);
      await settlement.save();
    }
    return successResponse(res, 200, refundResult.message || 'Refund processed successfully', {
      orderId: order.orderId,
      refundId: refundResult.refundId,
      refundAmount: refundResult.refundAmount,
      razorpayRefund: refundResult.razorpayRefund,
      message: refundResult.message
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    return errorResponse(res, 500, error.message || 'Failed to process refund');
  }
});
