import Order from '../../order/models/Order.js';
import RestaurantCommission from '../../admin/models/RestaurantCommission.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import RestaurantWallet from '../models/RestaurantWallet.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';

/**
 * Get restaurant finance/payout data
 * GET /api/restaurant/finance
 * Query params: startDate, endDate (for past cycles)
 */
export const getRestaurantFinance = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const {
      startDate,
      endDate
    } = req.query;

    // Get restaurant ID
    const restaurantId = restaurant._id?.toString() || restaurant.restaurantId || restaurant.id;
    if (!restaurantId) {
      return errorResponse(res, 500, 'Restaurant ID not found');
    }

    // Calculate current cycle dates (default: Monday to Sunday of current week)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert Sunday (0) to 6

    // Start of current cycle (Monday)
    const currentCycleStart = new Date(now);
    currentCycleStart.setDate(now.getDate() - daysFromMonday);
    currentCycleStart.setHours(0, 0, 0, 0);

    // End of current cycle (Sunday)
    const currentCycleEnd = new Date(currentCycleStart);
    currentCycleEnd.setDate(currentCycleStart.getDate() + 6);
    currentCycleEnd.setHours(23, 59, 59, 999);

    // Query for restaurant orders - handle multiple restaurantId formats
    const restaurantIdVariations = [restaurantId];
    if (mongoose.Types.ObjectId.isValid(restaurantId)) {
      const objectIdString = new mongoose.Types.ObjectId(restaurantId).toString();
      if (!restaurantIdVariations.includes(objectIdString)) {
        restaurantIdVariations.push(objectIdString);
      }
    }
    const restaurantIdQuery = {
      $or: [{
        restaurantId: {
          $in: restaurantIdVariations
        }
      }, {
        restaurantId: restaurantId
      }]
    };

    // Get commission setup and Wallet/Withdrawal info in parallel
    const [restaurantCommission, restaurantWallet, allWithdrawals] = await Promise.all([
      RestaurantCommission.findOne({
        restaurant: restaurantId,
        status: true
      }).lean().catch(() => null),
      RestaurantWallet.findOne({
        restaurant: restaurantId
      }).lean().catch(() => null),
      WithdrawalRequest.find({
        restaurantId: restaurant._id,
        status: {
          $in: ['Pending', 'Approved']
        }
      }).lean().catch(() => [])
    ]);

    // Helper function to calculate commission for an order
    const calculateCommissionForOrder = (orderAmount, commissionSetup) => {
      const setup = commissionSetup || { defaultCommission: { type: 'percentage', value: 10 } };

      const sortedRules = [...(setup.commissionRules || [])]
        .filter(rule => rule.isActive)
        .sort((a, b) => (b.priority - a.priority) || (a.minOrderAmount - b.minOrderAmount));

      let matchingRule = sortedRules.find(r => orderAmount >= r.minOrderAmount && (r.maxOrderAmount === null || orderAmount <= r.maxOrderAmount));

      let commission = 0;
      if (matchingRule) {
        commission = matchingRule.type === 'percentage' ? (orderAmount * matchingRule.value / 100) : matchingRule.value;
      } else {
        const def = setup.defaultCommission || { type: 'percentage', value: 10 };
        commission = def.type === 'percentage' ? (orderAmount * def.value / 100) : def.value;
      }
      return Math.round(commission * 100) / 100;
    };

    // Use aggregation to get data for current and past cycles efficiently
    const getCycleStats = async (start, end) => {
      const orders = await Order.find({
        ...restaurantIdQuery,
        status: 'delivered',
        $or: [
          { deliveredAt: { $gte: start, $lte: end } },
          { 'tracking.delivered.timestamp': { $gte: start, $lte: end } }
        ]
      })
        .select('orderId userId items pricing payment status address createdAt deliveredAt')
        .populate('userId', 'name phone email')
        .sort({ deliveredAt: -1 })
        .lean();

      let totalValue = 0;
      let totalCommission = 0;
      let recCount = 0;
      let recRev = 0;
      let recFees = 0;

      const formattedOrders = orders.map(order => {
        const subtotal = order.pricing?.subtotal || 0;
        const discount = order.pricing?.discount || 0;
        const foodPrice = subtotal - discount;
        const commission = calculateCommissionForOrder(foodPrice, restaurantCommission);

        totalValue += foodPrice;
        totalCommission += commission;

        const internalFee = order.pricing?.internalRecommendedFee || 0;
        recFees += internalFee;

        (order.items || []).forEach(item => {
          if (item.isRecommended) {
            recCount += (item.quantity || 1);
            recRev += (item.price || 0) * (item.quantity || 1);
          }
        });

        return {
          orderId: order.orderId || order._id.toString(),
          orderTotal: foodPrice,
          totalAmount: order.pricing?.total || 0,
          commission,
          payout: foodPrice - commission,
          deliveredAt: order.deliveredAt || order.createdAt,
          customerName: order.userId?.name || 'N/A',
          customerPhone: order.userId?.phone || 'N/A',
          foodNames: (order.items || []).map(i => i.name).join(', ')
        };
      });

      return {
        totalOrders: orders.length,
        totalOrderValue: Math.round(totalValue * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        orders: formattedOrders,
        recommendedItems: {
          count: recCount,
          revenue: Math.round(recRev * 100) / 100,
          fees: Math.round(recFees * 100) / 100
        }
      };
    };

    // Execute fetches in parallel
    const currentStatsPromise = getCycleStats(currentCycleStart, currentCycleEnd);
    const pastStatsPromise = (startDate && endDate) ? getCycleStats(new Date(startDate), new Date(endDate)) : Promise.resolve(null);

    const [currentStats, pastStats] = await Promise.all([currentStatsPromise, pastStatsPromise]);

    const totalWithdrawals = allWithdrawals.reduce((sum, req) => sum + (req.amount || 0), 0);
    const currentCyclePayout = Math.round((currentStats.totalOrderValue - currentStats.totalCommission) * 100) / 100;
    const availablePayout = Math.max(0, Math.round((currentCyclePayout - totalWithdrawals) * 100) / 100);

    // Format cycle dates
    const formatCycleDate = d => ({
      day: d.getDate().toString(),
      month: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear().toString().slice(-2)
    });

    return successResponse(res, 200, 'Finance data retrieved successfully', {
      currentCycle: {
        start: formatCycleDate(currentCycleStart),
        end: formatCycleDate(currentCycleEnd),
        ...currentStats,
        estimatedPayout: availablePayout,
        // Limit dashboard orders to latest 20 to reduce payload size
        orders: currentStats.orders.slice(0, 20)
      },
      pastCycles: pastStats ? {
        dateRange: { start: formatCycleDate(new Date(startDate)), end: formatCycleDate(new Date(endDate)) },
        ...pastStats
      } : null,
      restaurant: {
        name: restaurant.name || 'Restaurant',
        restaurantId: restaurant.restaurantId || restaurantId,
        address: restaurant.location?.address || restaurant.location?.formattedAddress || ''
      }
    });
  } catch (error) {
    console.error('Error fetching restaurant finance:', error);
    return errorResponse(res, 500, 'Failed to fetch finance data');
  }
});