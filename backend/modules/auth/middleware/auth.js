import jwtService from "../services/jwtService.js";
import User from "../models/User.js";
import { errorResponse } from "../../../shared/utils/response.js";

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

    // Get user from database
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return errorResponse(res, 401, "User not found");
    }

    if (!user.isActive) {
      return errorResponse(res, 401, "User account is inactive");
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

    // Try finding in User first (most common)
    let user = await User.findById(decoded.userId).select("-password");

    // If not found in User, check Admin (since we have separate collections)
    if (!user) {
      const { default: Admin } = await import("../../admin/models/Admin.js");
      user = await Admin.findById(decoded.userId).select("-password");
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
