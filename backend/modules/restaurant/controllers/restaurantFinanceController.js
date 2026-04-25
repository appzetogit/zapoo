import Order from '../../order/models/Order.js';
import OrderSettlement from '../../order/models/OrderSettlement.js';
import RestaurantCommission from '../../admin/models/RestaurantCommission.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import RestaurantWallet from '../models/RestaurantWallet.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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

    // Query for restaurant orders - support both ObjectId-string and public restaurantId formats
    const restaurantIdVariations = [
      restaurant._id?.toString(),
      restaurant.restaurantId,
      restaurant.id,
      restaurantId
    ].filter(Boolean);
    const uniqueRestaurantIdVariations = [...new Set(restaurantIdVariations)];
    if (mongoose.Types.ObjectId.isValid(restaurantId)) {
      const objectIdString = new mongoose.Types.ObjectId(restaurantId).toString();
      if (!uniqueRestaurantIdVariations.includes(objectIdString)) {
        uniqueRestaurantIdVariations.push(objectIdString);
      }
    }

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
    const normalizeStartOfDay = (dateValue) => {
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const normalizeEndOfDay = (dateValue) => {
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(23, 59, 59, 999);
      return d;
    };

    const getCycleStats = async (start, end) => {
      const orders = await Order.find({
        restaurantId: { $in: uniqueRestaurantIdVariations },
        status: 'delivered',
        $or: [
          { deliveredAt: { $gte: start, $lte: end } },
          { 'tracking.delivered.timestamp': { $gte: start, $lte: end } }
        ]
      })
        .select('orderId userId items pricing payment status address createdAt deliveredAt tracking.confirmed.timestamp')
        .populate('userId', 'name phone email')
        .sort({ deliveredAt: -1 })
        .lean();

      const orderIds = orders.map(order => order._id).filter(Boolean);
      const settlements = orderIds.length > 0
        ? await OrderSettlement.find({ orderId: { $in: orderIds } })
          .select('orderId userPayment.deliveryFee userPayment.platformFee restaurantEarning.adminDeliveryCost restaurantEarning.adminDeliveryGst restaurantEarning.platformFee restaurantEarning.gstCollected')
          .lean()
        : [];
      const settlementByOrderId = new Map(
        settlements.map(s => [String(s.orderId), s])
      );

      let totalValue = 0;
      let totalCommission = 0;
      let recCount = 0;
      let recRev = 0;
      let recFees = 0;
      let totalTaxCollected = 0; // food GST + platform GST + customer delivery GST + admin delivery GST
      let totalPlatformFeeExclGst = 0; // platform fee only
      let totalCustomerDeliveryFeeExclGst = 0; // user charged delivery fee only
      let totalRestaurantToAdminDeliveryFeeExclGst = 0; // admin delivery cost
      let totalRestaurantToAdminDeliveryFeeInclGst = 0; // admin delivery cost + admin delivery gst

      const formattedOrders = orders.map(order => {
        const settlement = settlementByOrderId.get(String(order._id));
        const subtotal = order.pricing?.subtotal || 0;
        const discount = order.pricing?.discount || 0;
        const foodPrice = subtotal - discount;
        const commission = calculateCommissionForOrder(foodPrice, restaurantCommission);
        const settlementPlatformFee = Number(settlement?.restaurantEarning?.platformFee);
        const settlementUserPlatformFee = Number(settlement?.userPayment?.platformFee);
        const platformFeeExclGst = Number.isFinite(settlementPlatformFee) && settlementPlatformFee > 0
          ? settlementPlatformFee
          : (Number.isFinite(settlementUserPlatformFee) && settlementUserPlatformFee > 0
            ? settlementUserPlatformFee
            : (Number(order.pricing?.platformFee) || 0));

        const settlementCustomerDeliveryFee = Number(settlement?.userPayment?.deliveryFee);
        const customerDeliveryFeeExclGst = Number.isFinite(settlementCustomerDeliveryFee)
          ? settlementCustomerDeliveryFee
          : (Number(order.pricing?.deliveryFee) || 0);

        const settlementAdminDeliveryCost = Number(settlement?.restaurantEarning?.adminDeliveryCost);
        const restaurantToAdminDeliveryFeeExclGst = Number.isFinite(settlementAdminDeliveryCost)
          ? settlementAdminDeliveryCost
          : (Number(order.pricing?.adminDeliveryCost ?? order.pricing?.internalAdminDeliveryCost) || 0);

        const settlementAdminDeliveryGst = Number(settlement?.restaurantEarning?.adminDeliveryGst);
        const adminDeliveryGstRaw = Number(order.pricing?.adminDeliveryGst);
        const adminDeliveryGst = Number.isFinite(settlementAdminDeliveryGst)
          ? settlementAdminDeliveryGst
          : (Number.isFinite(adminDeliveryGstRaw)
            ? adminDeliveryGstRaw
            : roundCurrency(restaurantToAdminDeliveryFeeExclGst * 0.18));
        const restaurantToAdminDeliveryFeeInclGst = restaurantToAdminDeliveryFeeExclGst + adminDeliveryGst;
        const settlementTaxCollected = Number(settlement?.restaurantEarning?.gstCollected);
        const customerGst = Number(order.pricing?.gstCollected ?? order.pricing?.tax) || 0;
        const taxCollected = Number.isFinite(settlementTaxCollected) && settlementTaxCollected > 0
          ? settlementTaxCollected
          : (customerGst + adminDeliveryGst);

        totalValue += foodPrice;
        totalCommission += commission;
        totalTaxCollected += taxCollected;
        totalPlatformFeeExclGst += platformFeeExclGst;
        totalCustomerDeliveryFeeExclGst += customerDeliveryFeeExclGst;
        totalRestaurantToAdminDeliveryFeeExclGst += restaurantToAdminDeliveryFeeExclGst;
        totalRestaurantToAdminDeliveryFeeInclGst += restaurantToAdminDeliveryFeeInclGst;

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
          receivedAt: order?.tracking?.confirmed?.timestamp || order?.createdAt,
          deliveredAt: order.deliveredAt || order.createdAt,
          customerName: order.userId?.name || 'N/A',
          customerPhone: order.userId?.phone || 'N/A',
          foodNames: (order.items || []).map(i => i.name).join(', '),
          taxCollected: roundCurrency(taxCollected),
          platformFeeExclGst: roundCurrency(platformFeeExclGst),
          customerDeliveryFeeExclGst: roundCurrency(customerDeliveryFeeExclGst),
          restaurantToAdminDeliveryFeeExclGst: roundCurrency(restaurantToAdminDeliveryFeeExclGst),
          restaurantToAdminDeliveryFeeInclGst: roundCurrency(restaurantToAdminDeliveryFeeInclGst),
          customerGst: roundCurrency(customerGst),
          adminDeliveryGst: roundCurrency(adminDeliveryGst)
        };
      });

      return {
        totalOrders: orders.length,
        totalOrderValue: Math.round(totalValue * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        orders: formattedOrders,
        invoiceSummary: {
          taxCollected: roundCurrency(totalTaxCollected),
          platformFeeExclGst: roundCurrency(totalPlatformFeeExclGst),
          customerDeliveryFeeExclGst: roundCurrency(totalCustomerDeliveryFeeExclGst),
          restaurantToAdminDeliveryFeeExclGst: roundCurrency(totalRestaurantToAdminDeliveryFeeExclGst),
          restaurantToAdminDeliveryFeeInclGst: roundCurrency(totalRestaurantToAdminDeliveryFeeInclGst),
          orderCount: orders.length
        },
        recommendedItems: {
          count: recCount,
          revenue: Math.round(recRev * 100) / 100,
          fees: Math.round(recFees * 100) / 100
        }
      };
    };

    // Execute fetches in parallel
    const currentStatsPromise = getCycleStats(currentCycleStart, currentCycleEnd);
    const parsedStartDate = startDate ? normalizeStartOfDay(startDate) : null;
    const parsedEndDate = endDate ? normalizeEndOfDay(endDate) : null;
    const pastStatsPromise = (parsedStartDate && parsedEndDate)
      ? getCycleStats(parsedStartDate, parsedEndDate)
      : Promise.resolve(null);

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
        dateRange: { start: formatCycleDate(parsedStartDate), end: formatCycleDate(parsedEndDate) },
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
