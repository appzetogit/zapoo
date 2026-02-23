import DiningTable from '../../tableReservation/models/DiningTable.js';
import Reservation from '../../tableReservation/models/Reservation.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';

// ==================== TABLE MANAGEMENT (Restaurant) ====================

/**
 * Get all tables for the logged-in restaurant with real-time status
 */
export const getMyTables = async (req, res) => {
    try {
        const restaurantId = req.restaurant._id;
        const tables = await DiningTable.find({ restaurantId })
            .sort({ tableNumber: 1 })
            .lean();

        // Current time for "Booked" vs "Active" check
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentTime = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");

        const tablesWithStats = await Promise.all(tables.map(async (table) => {
            // Check if booked *right now*
            const currentBooking = await Reservation.findOne({
                tableId: table._id,
                status: 'confirmed',
                bookingDate: todayStr,
                startTime: { $lte: currentTime },
                endTime: { $gte: currentTime }
            });

            const bookingCount = await Reservation.countDocuments({
                tableId: table._id,
                status: 'confirmed',
                bookingDate: { $gte: todayStr }
            });

            return {
                ...table,
                reservationCount: bookingCount,
                isBookedNow: !!currentBooking
            };
        }));

        return successResponse(res, 200, 'Tables retrieved successfully', { tables: tablesWithStats });
    } catch (error) {
        console.error('Error fetching restaurant tables:', error);
        return errorResponse(res, 500, 'Failed to fetch tables');
    }
};

/**
 * Create a new table for the restaurant
 */
export const createRestaurantTable = async (req, res) => {
    try {
        const restaurantId = req.restaurant._id;
        const { tableNumber, capacity } = req.body;

        if (!tableNumber || !capacity) {
            return errorResponse(res, 400, 'tableNumber and capacity are required');
        }

        const table = new DiningTable({
            restaurantId,
            tableNumber,
            capacity: parseInt(capacity),
            isActive: true
        });

        await table.save();
        return successResponse(res, 201, 'Table created successfully', { table });
    } catch (error) {
        if (error.code === 11000) {
            return errorResponse(res, 409, 'Table number already exists for your restaurant');
        }
        console.error('Error creating restaurant table:', error);
        return errorResponse(res, 500, 'Failed to create table');
    }
};

/**
 * Update a table managed by the restaurant
 */
export const updateRestaurantTable = async (req, res) => {
    try {
        const restaurantId = req.restaurant._id;
        const { id } = req.params;
        const { tableNumber, capacity, isActive } = req.body;

        const table = await DiningTable.findOne({ _id: id, restaurantId });
        if (!table) return errorResponse(res, 404, 'Table not found or unauthorized');

        if (tableNumber !== undefined) table.tableNumber = tableNumber;
        if (capacity !== undefined) table.capacity = parseInt(capacity);
        if (isActive !== undefined) table.isActive = isActive;

        await table.save();
        return successResponse(res, 200, 'Table updated successfully', { table });
    } catch (error) {
        if (error.code === 11000) {
            return errorResponse(res, 409, 'Table number already exists for your restaurant');
        }
        console.error('Error updating restaurant table:', error);
        return errorResponse(res, 500, 'Failed to update table');
    }
};

/**
 * Delete a table managed by the restaurant
 */
export const deleteRestaurantTable = async (req, res) => {
    try {
        const restaurantId = req.restaurant._id;
        const { id } = req.params;

        const table = await DiningTable.findOneAndDelete({ _id: id, restaurantId });
        if (!table) return errorResponse(res, 404, 'Table not found or unauthorized');

        return successResponse(res, 200, 'Table deleted successfully');
    } catch (error) {
        console.error('Error deleting restaurant table:', error);
        return errorResponse(res, 500, 'Failed to delete table');
    }
};

// ==================== RESERVATION MANAGEMENT (Restaurant) ====================

/**
 * Get reservations for the logged-in restaurant
 */
export const getMyReservations = async (req, res) => {
    try {
        const restaurantId = req.restaurant._id;
        const { date, status } = req.query;

        const filter = { restaurantId: restaurantId };

        if (date) {
            filter.bookingDate = date; // Reservation model uses YYYY-MM-DD string
        }

        if (status) filter.status = status;

        const reservations = await Reservation.find(filter)
            .populate('userId', 'name email phone')
            .populate('tableId', 'tableNumber')
            .sort({ bookingDate: -1, startTime: -1 })
            .lean();

        // Map to match frontend expectations
        const mappedReservations = reservations.map(resv => ({
            ...resv,
            user: resv.userId, // Frontend expects 'user'
            date: resv.bookingDate,
            table: resv.tableId?.tableNumber
        }));

        return successResponse(res, 200, 'Reservations retrieved successfully', { reservations: mappedReservations });
    } catch (error) {
        console.error('Error fetching restaurant reservations:', error);
        return errorResponse(res, 500, 'Failed to fetch reservations');
    }
};

/**
 * NEW: Get all booked tables specifically for the "Booked Tables" section
 * GET /api/restaurant/booked-tables
 */
export const getBookedTables = async (req, res) => {
    try {
        const restaurantId = req.restaurant._id;
        const { date } = req.query;

        const filter = {
            restaurantId,
            status: { $nin: ['cancelled', 'no-show'] }
        };

        if (date) filter.bookingDate = date;

        const bookings = await Reservation.find(filter)
            .populate('userId', 'name email phone')
            .populate('tableId', 'tableNumber')
            .sort({ bookingDate: 1, startTime: 1 })
            .lean();

        const data = bookings.map(b => ({
            _id: b._id,
            tableNumber: b.tableId?.tableNumber || 'N/A',
            bookingDate: b.bookingDate,
            time: `${b.startTime} - ${b.endTime}`,
            guests: b.guestCount,
            userName: b.userId?.name || 'Guest',
            userPhone: b.userId?.phone || 'N/A',
            status: b.status
        }));

        return successResponse(res, 200, 'Booked tables retrieved', { bookings: data });
    } catch (error) {
        console.error('Error fetching booked tables:', error);
        return errorResponse(res, 500, 'Failed to fetch booked tables');
    }
};

/**
 * Update reservation status
 * PATCH /api/restaurant/dining/reservations/:id/status
 */
export const updateReservationStatus = async (req, res) => {
    try {
        const restaurantId = req.restaurant._id;
        const { id } = req.params;
        const { status } = req.body;

        if (!status) return errorResponse(res, 400, 'Status is required');

        const reservation = await Reservation.findOne({ _id: id, restaurantId });
        if (!reservation) return errorResponse(res, 404, 'Reservation not found or unauthorized');

        reservation.status = status;
        await reservation.save();

        return successResponse(res, 200, 'Reservation status updated', { reservation });
    } catch (error) {
        console.error('Error updating reservation status:', error);
        return errorResponse(res, 500, 'Failed to update reservation status');
    }
};
