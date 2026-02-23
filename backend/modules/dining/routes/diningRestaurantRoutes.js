import express from "express";
import {
    getMyTables,
    createRestaurantTable,
    updateRestaurantTable,
    deleteRestaurantTable,
    getMyReservations,
    getBookedTables,
    updateReservationStatus
} from "../controllers/diningRestaurantController.js";
import { authenticate as authenticateRestaurant } from "../../restaurant/middleware/restaurantAuth.js";

const router = express.Router();

// All routes here require restaurant authentication
router.use(authenticateRestaurant);

// Table Management
router.get("/tables", getMyTables);
router.post("/tables", createRestaurantTable);
router.put("/tables/:id", updateRestaurantTable);
router.delete("/tables/:id", deleteRestaurantTable);

// Reservations
router.get("/reservations", getMyReservations);
router.get("/booked-tables", getBookedTables);
router.patch("/reservations/:id/status", updateReservationStatus);

export default router;
