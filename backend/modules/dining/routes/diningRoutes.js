import express from "express";
import {
  getRestaurants,
  getRestaurantBySlug,
  getCategories,
  getLimelight,
  getBankOffers,
  getMustTries,
  getOfferBanners,
  getStories,
  createBooking,
  getUserBookings,
  getRestaurantBookings,
  updateBookingStatus,
  createDiningReview,
} from "../controllers/diningController.js";
import { authenticate as authenticateUser } from "../../auth/middleware/auth.js";
import { authenticate as authenticateRestaurant } from "../../restaurant/middleware/restaurantAuth.js";
import { authenticateAdmin } from "../../admin/middleware/adminAuth.js";

const router = express.Router();

router.get("/restaurants", getRestaurants);
router.get("/restaurants/:slug", getRestaurantBySlug);
router.get("/categories", getCategories);
router.get("/limelight", getLimelight);
router.get("/bank-offers", getBankOffers);
router.get("/must-tries", getMustTries);
router.get("/offer-banners", getOfferBanners);
router.get("/stories", getStories);

// Booking Routes
router.post("/bookings", authenticateUser, createBooking);
router.get("/bookings/my", authenticateUser, getUserBookings);
router.get(
  "/bookings/restaurant/:restaurantId",
  authenticateRestaurant,
  getRestaurantBookings,
);
// User or restaurant can update status
router.patch(
  "/bookings/:bookingId/status",
  authenticateUser,
  updateBookingStatus,
);
router.patch(
  "/bookings/:bookingId/status/restaurant",
  authenticateRestaurant,
  updateBookingStatus,
);
// Admin can also update booking status
router.patch(
  "/bookings/:bookingId/status/admin",
  authenticateAdmin,
  updateBookingStatus,
);
router.post("/reviews", authenticateUser, createDiningReview);

export default router;
