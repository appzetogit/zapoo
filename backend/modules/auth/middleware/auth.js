import jwtService from "../services/jwtService.js";
import User from "../models/User.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import { errorResponse } from "../../../shared/utils/response.js";
import { getRedisClient } from "../../../config/redis.js";

/**
 * Authentication Middleware
 * Verifies JWT access token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, 401, "No token provided");
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwtService.verifyAccessToken(token);
    const userId = decoded.userId;

    // Try to get user from Redis cache first
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cachedUser = await redisClient.get(`user_session:${userId}`);
        if (cachedUser) {
          req.user = JSON.parse(cachedUser);
          req.token = decoded;
          return next();
        }
      } catch (cacheErr) {
        console.warn(`[Redis] Cache read error for user ${userId}:`, cacheErr.message);
      }
    }

    // Get user from database - select only essential fields
    const user = await User.findById(userId).select("name email phone role profileImage isActive preferences").lean();

    if (!user) {
      return errorResponse(res, 401, "User not found");
    }

    if (!user.isActive) {
      return errorResponse(res, 401, "User account is inactive");
    }

    // Store in Redis if available (TTL: 1 hour)
    if (redisClient) {
      try {
        await redisClient.setEx(`user_session:${userId}`, 3600, JSON.stringify(user));
      } catch (cacheErr) {
        console.warn(`[Redis] Cache write error for user ${userId}:`, cacheErr.message);
      }
    }

    // Attach user to request
    req.user = user;
    req.token = decoded;

    next();
  } catch (error) {
    return errorResponse(res, 401, error.message || "Invalid token");
  }
};

/**
 * Role-based Authorization Middleware
 * @param {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, "Authentication required");
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        "Access denied. Insufficient permissions.",
      );
    }

    next();
  };
};

/**
 * Optional Authentication Middleware
 * Checks for token but does not error if missing.
 * Used for routes that have public and authenticated views.
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // No token, proceed as guest
    }

    const token = authHeader.substring(7);
    const decoded = jwtService.verifyAccessToken(token);

    // Restaurant tokens need to resolve against the Restaurant collection,
    // otherwise optional auth endpoints like subscription plans lose tier context.
    if (decoded.role === "restaurant") {
      const restaurant = await Restaurant.findById(decoded.userId)
        .select("name email phone isActive zoneId tierId subscription queuedSubscription trialUsed businessModel")
        .populate({
          path: "zoneId",
          populate: { path: "tierId" },
        })
        .lean();

      if (restaurant) {
        req.user = { ...restaurant, role: "restaurant" };
        req.restaurant = restaurant;
        req.token = decoded;
      }

      return next();
    }

    // Try finding in User first (most common)
    let user = await User.findById(decoded.userId).select("name email phone role profileImage isActive preferences").lean();

    // If not found in User, check Admin (since we have separate collections)
    if (!user) {
      const { default: Admin } = await import("../../admin/models/Admin.js");
      user = await Admin.findById(decoded.userId).select("name email role isActive").lean();
    }

    if (user && user.isActive) {
      req.user = user;
      req.token = decoded;

      // If it's an admin, also set req.admin for consistency with other middlewares
      if (decoded.role === 'admin') {
        req.admin = user;
      }
    }

    next();
  } catch (error) {
    // If token is invalid, just proceed as guest
    next();
  }
};

export default { authenticate, authorize, optionalAuthenticate };
