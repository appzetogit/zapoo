import WithdrawalRequest from "../models/WithdrawalRequest.js";
import RestaurantWallet from "../models/RestaurantWallet.js";
import Restaurant from "../models/Restaurant.js";
import BusinessSettings from "../../admin/models/BusinessSettings.js";
import { sendNotificationToUser } from "../../notification/utils/pushNotificationHelper.js";
import { successResponse, errorResponse } from "../../../shared/utils/response.js";
import asyncHandler from "../../../shared/middleware/asyncHandler.js";
import winston from "winston";
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

const isRestaurantWithdrawalDay = (date = new Date()) => {
  const day = date.getDate();
  return day % 3 === 0;
};

/**
 * Create Withdrawal Request
 * POST /api/restaurant/withdrawal/request
 */
export const createWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const {
      amount
    } = req.body;
    if (!restaurant || !restaurant._id) {
      return errorResponse(res, 401, "Restaurant authentication required");
    }
    if (!amount || amount <= 0) {
      return errorResponse(res, 400, "Valid withdrawal amount is required");
    }

    const settings = await BusinessSettings.getSettings().catch(() => null);
    const windowCfg = settings?.withdrawalWindows?.restaurant;
    const now = new Date();
    const isSameDay = (a, b) =>
      a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const openDates = windowCfg?.openDates || [];
    const closedDates = windowCfg?.closedDates || [];
    const isInList = (list) => list.some((d) => isSameDay(new Date(d), now));
    if (isInList(closedDates)) {
      return errorResponse(res, 400, "Withdrawal window is temporarily closed");
    }
    if (!isInList(openDates) && !isRestaurantWithdrawalDay()) {
      return errorResponse(res, 400, "Withdrawal requests are allowed only on calendar days 3, 6, 9, 12, ...");
    }

    // Get restaurant wallet
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(restaurant._id);

    // Check if sufficient balance
    const availableBalance = wallet.totalBalance || 0;
    if (amount > availableBalance) {
      return errorResponse(res, 400, "Insufficient balance. Available balance: ₹" + availableBalance.toFixed(2));
    }

    // Check for pending requests
    const pendingRequest = await WithdrawalRequest.findOne({
      restaurantId: restaurant._id,
      status: "Pending"
    });
    if (pendingRequest) {
      return errorResponse(res, 400, "You already have a pending withdrawal request");
    }

    // Get restaurant details
    const restaurantDetails = await Restaurant.findById(restaurant._id).select("name restaurantId");

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create({
      restaurantId: restaurant._id,
      amount: parseFloat(amount),
      status: "Pending",
      restaurantName: restaurantDetails?.name || restaurant.name || "Unknown",
      restaurantIdString: restaurantDetails?.restaurantId || restaurant.restaurantId || restaurant._id.toString()
    });

    // Deduct balance immediately when withdrawal request is created
    // Create a pending withdrawal transaction
    const withdrawalRequestId = withdrawalRequest._id.toString();
    const transaction = wallet.addTransaction({
      amount: parseFloat(amount),
      type: "withdrawal",
      status: "Pending",
      description: `Withdrawal request created - Request ID: ${withdrawalRequestId}`
    });

    // Manually deduct from balance (since addTransaction only deducts when status is 'Completed')
    wallet.totalBalance = Math.max(0, (wallet.totalBalance || 0) - parseFloat(amount));
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + parseFloat(amount);
    await wallet.save();

    // Link transaction ID to withdrawal request for easier tracking
    withdrawalRequest.transactionId = transaction._id;
    await withdrawalRequest.save();
    // Send email alert to admin
    try {
      // Import emailService dynamically
      const emailService = (await import("../../auth/services/emailService.js")).default;
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
      if (adminEmail) {
        emailService.sendWithdrawalRequestAlert(adminEmail, {
          restaurantName: withdrawalRequest.restaurantName,
          amount: withdrawalRequest.amount,
          requestId: withdrawalRequest._id.toString().slice(-6).toUpperCase()
        }).catch(err => logger.error(`Failed to send withdrawal alert: ${err.message}`));
      }
    } catch (emailError) {
      logger.error(`Error sending withdrawal email: ${emailError.message}`);
    }
    return successResponse(res, 201, "Withdrawal request created successfully", {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        requestedAt: withdrawalRequest.requestedAt,
        createdAt: withdrawalRequest.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error creating withdrawal request: ${error.message}`);
    return errorResponse(res, 500, "Failed to create withdrawal request");
  }
});

/**
 * Get Restaurant Withdrawal Requests (for restaurant)
 * GET /api/restaurant/withdrawal/requests
 */
export const getRestaurantWithdrawalRequests = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const {
      status,
      page = 1,
      limit = 20
    } = req.query;
    if (!restaurant || !restaurant._id) {
      return errorResponse(res, 401, "Restaurant authentication required");
    }
    const query = {
      restaurantId: restaurant._id
    };
    if (status && ["Pending", "Approved", "Rejected", "Processed"].includes(status)) {
      query.status = status;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const requests = await WithdrawalRequest.find(query).sort({
      createdAt: -1
    }).skip(skip).limit(parseInt(limit)).populate("processedBy", "name email").lean();
    const total = await WithdrawalRequest.countDocuments(query);
    return successResponse(res, 200, "Withdrawal requests retrieved successfully", {
      requests: requests.map(req => ({
        id: req._id,
        amount: req.amount,
        status: req.status,
        requestedAt: req.requestedAt,
        processedAt: req.processedAt,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching withdrawal requests: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch withdrawal requests");
  }
});

/**
 * Get All Withdrawal Requests (for admin)
 * GET /api/admin/withdrawal/requests
 */
export const getAllWithdrawalRequests = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      search
    } = req.query;
    const query = {};
    if (status && ["Pending", "Approved", "Rejected", "Processed"].includes(status)) {
      query.status = status;
    }

    // Search by restaurant name or ID
    if (search) {
      query.$or = [{
        restaurantName: {
          $regex: search,
          $options: "i"
        }
      }, {
        restaurantIdString: {
          $regex: search,
          $options: "i"
        }
      }];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const enrichedRequests = await WithdrawalRequest.find(query).sort({
      createdAt: -1
    }).skip(skip).limit(parseInt(limit)).populate({
      path: "restaurantId",
      select: "name restaurantId ownerName ownerEmail ownerPhone email phone primaryContactNumber location onboarding.step1 onboarding.step3 zoneId tierId",
      populate: [{
        path: "zoneId",
        select: "name zoneName serviceLocation"
      }, {
        path: "tierId",
        select: "name rank"
      }]
    }).populate("processedBy", "name email").lean();
    const total = await WithdrawalRequest.countDocuments(query);
    const populateRestaurantDetails = {
      path: "zoneId",
      select: "name zoneName serviceLocation"
    };
    const populateTierDetails = {
      path: "tierId",
      select: "name rank"
    };
    const requests = await Promise.all(enrichedRequests.map(async (req) => {
      let restaurant = req.restaurantId || null;
      const isPopulatedRestaurant = restaurant && typeof restaurant === "object" && restaurant._id;

      if (!isPopulatedRestaurant) {
        const restaurantIdCandidate = typeof req.restaurantId === "string" ? req.restaurantId : null;
        if (restaurantIdCandidate) {
          restaurant = await Restaurant.findById(restaurantIdCandidate)
            .select("name restaurantId ownerName ownerEmail ownerPhone email phone primaryContactNumber location onboarding.step1 onboarding.step3 zoneId tierId")
            .populate(populateRestaurantDetails)
            .populate(populateTierDetails)
            .lean();
        }
      }

      if ((!restaurant || !restaurant._id) && req.restaurantIdString) {
        restaurant = await Restaurant.findOne({ restaurantId: req.restaurantIdString })
          .select("name restaurantId ownerName ownerEmail ownerPhone email phone primaryContactNumber location onboarding.step1 onboarding.step3 zoneId tierId")
          .populate(populateRestaurantDetails)
          .populate(populateTierDetails)
          .lean();
      }

      const location = restaurant?.location || {};
      const step1Location = restaurant?.onboarding?.step1?.location || {};
      const gstAddress = restaurant?.onboarding?.step3?.gst?.address;
      const composedAddress = [
        location.addressLine1 || step1Location.addressLine1,
        location.addressLine2 || step1Location.addressLine2,
        location.area || step1Location.area,
        location.city || step1Location.city,
        location.state || step1Location.state,
        location.zipCode || location.pincode || location.postalCode || step1Location.zipCode || step1Location.pincode || step1Location.postalCode,
      ].filter(Boolean).join(", ");

      return {
        id: req._id,
        restaurantId: restaurant?._id || req.restaurantId,
        restaurantName: req.restaurantName || restaurant?.name || "Unknown",
        restaurantIdString: req.restaurantIdString || restaurant?.restaurantId || "N/A",
        restaurantAddress: location.formattedAddress || location.address || step1Location.formattedAddress || step1Location.address || gstAddress || composedAddress || "N/A",
        ownerName: restaurant?.ownerName || restaurant?.onboarding?.step1?.ownerName || "N/A",
        ownerEmail: restaurant?.ownerEmail || restaurant?.onboarding?.step1?.ownerEmail || restaurant?.email || "N/A",
        ownerPhone: restaurant?.ownerPhone || restaurant?.onboarding?.step1?.ownerPhone || restaurant?.primaryContactNumber || restaurant?.phone || "N/A",
        bankAccountNumber: restaurant?.onboarding?.step3?.bank?.accountNumber || req.bankDetails?.accountNumber || "N/A",
        bankIfscCode: restaurant?.onboarding?.step3?.bank?.ifscCode || req.bankDetails?.ifscCode || "N/A",
        bankAccountHolderName: restaurant?.onboarding?.step3?.bank?.accountHolderName || req.bankDetails?.accountHolderName || "N/A",
        bankAccountType: restaurant?.onboarding?.step3?.bank?.accountType || "N/A",
        zoneName: restaurant?.zoneId?.zoneName || restaurant?.zoneId?.name || "N/A",
        tierName: restaurant?.tierId?.name || "N/A",
        tierRank: restaurant?.tierId?.rank ?? null,
        amount: req.amount,
        status: req.status,
        requestedAt: req.requestedAt,
        processedAt: req.processedAt,
        processedBy: req.processedBy ? {
          name: req.processedBy.name,
          email: req.processedBy.email
        } : null,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      };
    }));
    return successResponse(res, 200, "Withdrawal requests retrieved successfully", {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching all withdrawal requests: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch withdrawal requests");
  }
});

/**
 * Approve Withdrawal Request (admin only)
 * POST /api/admin/withdrawal/:id/approve
 */
export const approveWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const {
      id
    } = req.params;
    if (!admin || !admin._id) {
      return errorResponse(res, 401, "Admin authentication required");
    }
    const withdrawalRequest = await WithdrawalRequest.findById(id).populate("restaurantId");
    if (!withdrawalRequest) {
      return errorResponse(res, 404, "Withdrawal request not found");
    }
    if (withdrawalRequest.status !== "Pending") {
      return errorResponse(res, 400, `Withdrawal request is already ${withdrawalRequest.status}`);
    }

    // Get restaurant wallet
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(withdrawalRequest.restaurantId._id);

    // Update withdrawal request
    withdrawalRequest.status = "Approved";
    withdrawalRequest.processedAt = new Date();
    withdrawalRequest.processedBy = admin._id;
    await withdrawalRequest.save();

    // Find and update the pending withdrawal transaction to Completed
    // Balance was already deducted when request was created, so we just mark transaction as completed
    let pendingTransaction = null;
    if (withdrawalRequest.transactionId) {
      // Find transaction by ID if linked
      pendingTransaction = wallet.transactions.id(withdrawalRequest.transactionId);
    }
    if (!pendingTransaction) {
      // Fallback: find by description
      pendingTransaction = wallet.transactions.find(t => t.type === "withdrawal" && t.status === "Pending" && t.description?.includes(withdrawalRequest._id.toString()));
    }
    if (pendingTransaction) {
      // Update transaction status to Completed
      pendingTransaction.status = "Completed";
      pendingTransaction.processedAt = new Date();
      // Balance was already deducted, so no need to deduct again
    } else {
      // If transaction not found, create a new one (fallback)
      wallet.addTransaction({
        amount: withdrawalRequest.amount,
        type: "withdrawal",
        status: "Completed",
        description: `Withdrawal request approved - Request ID: ${withdrawalRequest._id}`
      });
      // Balance already deducted, so we don't deduct again
    }
    await wallet.save();
    // Send email notification to restaurant
    try {
      const emailService = (await import("../../auth/services/emailService.js")).default;
      const restaurant = withdrawalRequest.restaurantId;
      const recipientEmail = restaurant.ownerEmail || restaurant.email;

      // Check if it's a valid email (not the dummy one) and send
      if (recipientEmail && !recipientEmail.includes("@restaurant.appzeto.com")) {
        emailService.sendWithdrawalStatusEmail(recipientEmail, {
          status: "Approved",
          amount: withdrawalRequest.amount,
          requestId: withdrawalRequest._id.toString().slice(-6).toUpperCase()
        }).catch(err => logger.error(`Failed to send withdrawal approval email: ${err.message}`));
      }
    } catch (emailError) {
      logger.error(`Error sending withdrawal email: ${emailError.message}`);
    }

    // Send push notification to restaurant
    try {
      const restaurantId = withdrawalRequest.restaurantId?._id?.toString() || withdrawalRequest.restaurantId?.toString();
      if (restaurantId) {
        await sendNotificationToUser(
          restaurantId,
          "restaurant",
          "Withdrawal Request Approved",
          "Admin has approved your withdrawal request. Withdrawal will be processed soon.",
          {
            type: "withdrawal_approved",
            withdrawalRequestId: withdrawalRequest._id?.toString(),
            amount: String(withdrawalRequest.amount || 0),
            clickUrl: "/restaurant/withdrawal-history"
          }
        );
      }
    } catch (pushError) {
      logger.error(`Error sending withdrawal approval push notification: ${pushError.message}`);
    }

    return successResponse(res, 200, "Withdrawal request approved successfully", {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        processedAt: withdrawalRequest.processedAt
      }
    });
  } catch (error) {
    logger.error(`Error approving withdrawal request: ${error.message}`);
    return errorResponse(res, 500, "Failed to approve withdrawal request");
  }
});

/**
 * Reject Withdrawal Request (admin only)
 * POST /api/admin/withdrawal/:id/reject
 */
export const rejectWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const {
      id
    } = req.params;
    const {
      rejectionReason
    } = req.body;
    if (!admin || !admin._id) {
      return errorResponse(res, 401, "Admin authentication required");
    }
    const withdrawalRequest = await WithdrawalRequest.findById(id).populate("restaurantId");
    if (!withdrawalRequest) {
      return errorResponse(res, 404, "Withdrawal request not found");
    }
    if (withdrawalRequest.status !== "Pending") {
      return errorResponse(res, 400, `Withdrawal request is already ${withdrawalRequest.status}`);
    }

    // Get restaurant wallet to refund the balance
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(withdrawalRequest.restaurantId._id || withdrawalRequest.restaurantId);

    // Update withdrawal request
    withdrawalRequest.status = "Rejected";
    withdrawalRequest.processedAt = new Date();
    withdrawalRequest.processedBy = admin._id;
    if (rejectionReason) {
      withdrawalRequest.rejectionReason = rejectionReason;
    }
    await withdrawalRequest.save();

    // Find and update the pending withdrawal transaction to Cancelled
    // Refund the balance back
    let pendingTransaction = null;
    if (withdrawalRequest.transactionId) {
      // Find transaction by ID if linked
      pendingTransaction = wallet.transactions.id(withdrawalRequest.transactionId);
    }
    if (!pendingTransaction) {
      // Fallback: find by description
      pendingTransaction = wallet.transactions.find(t => t.type === "withdrawal" && t.status === "Pending" && t.description?.includes(withdrawalRequest._id.toString()));
    }
    if (pendingTransaction) {
      // Update transaction status to Cancelled
      pendingTransaction.status = "Cancelled";
      pendingTransaction.processedAt = new Date();

      // Refund the balance back
      wallet.totalBalance = (wallet.totalBalance || 0) + withdrawalRequest.amount;
      wallet.totalWithdrawn = Math.max(0, (wallet.totalWithdrawn || 0) - withdrawalRequest.amount);
    } else {
      // If transaction not found, create a refund transaction (fallback)
      wallet.addTransaction({
        amount: withdrawalRequest.amount,
        type: "refund",
        status: "Completed",
        description: `Withdrawal request rejected - Refund for Request ID: ${withdrawalRequest._id}`
      });
      // Refund the balance
      wallet.totalBalance = (wallet.totalBalance || 0) + withdrawalRequest.amount;
      wallet.totalWithdrawn = Math.max(0, (wallet.totalWithdrawn || 0) - withdrawalRequest.amount);
    }
    await wallet.save();
    // Send email notification to restaurant
    try {
      const emailService = (await import("../../auth/services/emailService.js")).default;
      const restaurant = withdrawalRequest.restaurantId;
      const recipientEmail = restaurant.ownerEmail || restaurant.email;
      if (recipientEmail && !recipientEmail.includes("@restaurant.appzeto.com")) {
        emailService.sendWithdrawalStatusEmail(recipientEmail, {
          status: "Rejected",
          amount: withdrawalRequest.amount,
          requestId: withdrawalRequest._id.toString().slice(-6).toUpperCase(),
          rejectionReason: withdrawalRequest.rejectionReason
        }).catch(err => logger.error(`Failed to send withdrawal rejection email: ${err.message}`));
      }
    } catch (emailError) {
      logger.error(`Error sending withdrawal email: ${emailError.message}`);
    }
    return successResponse(res, 200, "Withdrawal request rejected successfully", {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        processedAt: withdrawalRequest.processedAt,
        rejectionReason: withdrawalRequest.rejectionReason
      }
    });
  } catch (error) {
    logger.error(`Error rejecting withdrawal request: ${error.message}`);
    return errorResponse(res, 500, "Failed to reject withdrawal request");
  }
});
