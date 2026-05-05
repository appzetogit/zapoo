import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../models/Delivery.js';
import Order from '../../order/models/Order.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get Delivery Partner Earnings
 * GET /api/delivery/earnings
 * Query params: period (today, week, month, all), page, limit, date (for specific date/week/month)
 */
export const getEarnings = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { period = 'all', page = 1, limit = 1000, date } = req.query;

    // Calculate date range based on period and optional date parameter
    let startDate = null;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of day

    // If date is provided, use it as base date for period calculation
    const baseDate = date ? new Date(date) : new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(baseDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(baseDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Get week range (Monday to Sunday)
        startDate = new Date(baseDate);
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'all':
      default:
        startDate = null;
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    // Get or create wallet for delivery partner
    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(delivery._id);

    // Filter transactions based on period and type
    let transactions = wallet.transactions || [];
    
    // Filter by transaction type (only 'payment' type for earnings)
    transactions = transactions.filter(t => 
      t.type === 'payment' && 
      t.status === 'Completed'
    );

    // Filter by date range if period is specified
    if (startDate) {
      transactions = transactions.filter(t => {
        const transactionDate = t.createdAt || t.processedAt || new Date();
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Sort by date (newest first)
    transactions.sort((a, b) => {
      const dateA = a.createdAt || a.processedAt || new Date(0);
      const dateB = b.createdAt || b.processedAt || new Date(0);
      return dateB - dateA;
    });

    // Get order details for each transaction
    const orderIds = transactions
      .filter(t => t.orderId)
      .map(t => t.orderId);

    // Fetch orders in batch
    const orders = await Order.find({
      _id: { $in: orderIds }
    })
      .select('orderId restaurantName deliveredAt createdAt')
      .lean();

    // Create order map for quick lookup
    const orderMap = {};
    orders.forEach(order => {
      orderMap[order._id.toString()] = order;
    });

    // Combine transaction and order data
    const earnings = transactions.map(transaction => {
      const order = transaction.orderId ? orderMap[transaction.orderId.toString()] : null;
      return {
        transactionId: transaction._id?.toString(),
        orderId: order?.orderId || transaction.orderId?.toString() || 'Unknown',
        restaurantName: order?.restaurantName || 'Unknown Restaurant',
        amount: transaction.amount || 0,
        description: transaction.description || '',
        deliveredAt: order?.deliveredAt || transaction.createdAt || transaction.processedAt,
        createdAt: transaction.createdAt || transaction.processedAt,
        paymentCollected: transaction.paymentCollected || false
      };
    });

    // Calculate pagination
    const totalEarnings = earnings.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedEarnings = earnings.slice(skip, skip + parseInt(limit));

    // Calculate summary statistics
    const totalAmount = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalOrders = earnings.length;
    
    // Calculate time on orders (difference between order creation and delivery)
    let totalTimeMinutes = 0;
    earnings.forEach(e => {
      // Find order by orderId string (e.orderId is string like "ORD-123-456")
      const order = orders.find(o => o.orderId === e.orderId);
      if (order && order.createdAt && order.deliveredAt) {
        const timeDiff = new Date(order.deliveredAt) - new Date(order.createdAt);
        totalTimeMinutes += Math.floor(timeDiff / (1000 * 60));
      }
    });

    const totalHours = Math.floor(totalTimeMinutes / 60);
    const totalMinutesRemainder = totalTimeMinutes % 60;

    // Calculate breakdown
    const orderEarning = totalAmount; // All payments are order earnings
    const incentive = 0; // Can be added from bonus transactions separately if needed
    const otherEarnings = 0; // Can include tips, bonuses, etc.

    return successResponse(res, 200, 'Earnings retrieved successfully', {
      earnings: paginatedEarnings,
      summary: {
        period,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        totalOrders,
        totalEarnings: totalAmount,
        totalHours,
        totalMinutes: totalMinutesRemainder,
        orderEarning,
        incentive,
        otherEarnings
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalEarnings,
        pages: Math.ceil(totalEarnings / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching delivery earnings: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch earnings');
  }
});

/**
 * Get delivery cash limit breakdown
 * GET /api/delivery/cash-limit
 */
export const getCashLimit = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(delivery._id);
    const settings = await BusinessSettings.getSettings().catch(() => null);

    const totalCashLimit = Math.max(0, Number(settings?.deliveryCashLimit) || 0);
    const cashInHand = Math.max(0, Number(wallet?.cashInHand) || 0);
    const deductions = Math.max(
      0,
      (wallet.transactions || [])
        .filter((t) => t?.status === 'Completed' && t?.type === 'deduction')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    );
    const pocketWithdrawals = Math.max(0, Number(wallet?.totalWithdrawn) || 0);

    return successResponse(res, 200, 'Cash limit retrieved successfully', {
      totalCashLimit,
      cashInHand,
      deductions,
      pocketWithdrawals,
      availableCashLimit: Math.max(0, totalCashLimit - cashInHand)
    });
  } catch (error) {
    logger.error(`Error fetching cash limit: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch cash limit');
  }
});

/**
 * Get pocket details for selected week/date window
 * GET /api/delivery/pocket-details?date=<iso>&limit=<n>
 */
export const getPocketDetails = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const { date, limit = 500 } = req.query;

    const baseDate = date ? new Date(date) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      return errorResponse(res, 400, 'Invalid date parameter');
    }

    // Sunday -> Saturday range (aligned with deliveryV2 UI week selector)
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);
    const day = startDate.getDay();
    startDate.setDate(startDate.getDate() - day);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const wallet = await DeliveryWallet.findOrCreateByDeliveryId(delivery._id);
    const allTransactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
    const completedInRange = allTransactions.filter((t) => {
      if (t?.status !== 'Completed') return false;
      const txDate = new Date(t.createdAt || t.processedAt || t.date || 0);
      if (Number.isNaN(txDate.getTime())) return false;
      return txDate >= startDate && txDate <= endDate;
    });

    const paymentTransactions = completedInRange
      .filter((t) => t.type === 'payment')
      .map((t) => ({
        id: t._id?.toString?.() || String(t._id || ''),
        amount: Number(t.amount) || 0,
        orderId: t.orderId?.toString?.() || String(t.orderId || ''),
        type: t.type,
        status: t.status,
        createdAt: t.createdAt || t.processedAt || t.date
      }));

    const bonusTransactions = completedInRange
      .filter((t) => t.type === 'bonus')
      .map((t) => ({
        id: t._id?.toString?.() || String(t._id || ''),
        amount: Number(t.amount) || 0,
        orderId: t.orderId?.toString?.() || String(t.orderId || ''),
        type: t.type,
        status: t.status,
        createdAt: t.createdAt || t.processedAt || t.date
      }));

    const deliveredOrders = await Order.find({
      deliveryPartnerId: delivery._id,
      $or: [
        { status: 'delivered' },
        { 'deliveryState.status': 'delivered' },
        { 'deliveryState.currentPhase': 'completed' }
      ],
      deliveredAt: { $gte: startDate, $lte: endDate }
    })
      .select('orderId _id restaurantName deliveredAt createdAt payment')
      .sort({ deliveredAt: -1 })
      .limit(Math.max(1, Number(limit) || 500))
      .lean();

    const paymentByOrderObjectId = new Map(paymentTransactions.map((t) => [String(t.orderId || ''), t]));
    const paymentByOrderCode = new Map();
    for (const t of paymentTransactions) {
      if (!t.orderId) continue;
      paymentByOrderCode.set(String(t.orderId), t);
    }

    const trips = deliveredOrders.map((order) => {
      const byObjectId = paymentByOrderObjectId.get(String(order._id));
      const byOrderCode = paymentByOrderCode.get(String(order.orderId || ''));
      const paymentTx = byObjectId || byOrderCode || null;
      return {
        _id: order._id?.toString?.() || String(order._id || ''),
        orderId: order.orderId || order._id?.toString?.() || '',
        restaurantName: order.restaurantName || 'Restaurant',
        deliveredAt: order.deliveredAt || order.createdAt,
        createdAt: order.createdAt,
        paymentMethod: order?.payment?.method || 'online',
        deliveryEarning: Number(paymentTx?.amount) || 0
      };
    });

    const totalEarning = paymentTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalBonus = bonusTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return successResponse(res, 200, 'Pocket details retrieved successfully', {
      range: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      summary: {
        totalEarning,
        totalBonus,
        grandTotal: totalEarning + totalBonus
      },
      trips,
      transactions: {
        payment: paymentTransactions,
        bonus: bonusTransactions
      }
    });
  } catch (error) {
    logger.error(`Error fetching pocket details: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch pocket details');
  }
});

/**
 * Get referral stats (compat API for deliveryV2 profile page)
 * GET /api/delivery/referrals/stats
 */
export const getReferralStats = asyncHandler(async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.delivery._id)
      .select('_id deliveryId name createdAt')
      .lean();
    if (!delivery) return errorResponse(res, 404, 'Delivery partner not found');

    return successResponse(res, 200, 'Referral stats retrieved successfully', {
      referralCode: delivery.deliveryId || delivery._id?.toString?.() || '',
      referralCount: 0,
      rewardAmount: 0
    });
  } catch (error) {
    logger.error(`Error fetching referral stats: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch referral stats');
  }
});
