import DiningTable from "../models/DiningTable.js";
import Reservation from "../models/Reservation.js";
import Restaurant from "../../restaurant/models/Restaurant.js";

// Helper function to check if two time ranges overlap (HH:mm format)
// Assumes times are string comparisons or parsing them into minutes
const extractMins = (timeStr) => {
    const [hours, mins] = timeStr.split(":").map(Number);
    return hours * 60 + mins;
};

// GET /api/available-tables
export const getAvailableTables = async (req, res) => {
    try {
        const { restaurantId, date, startTime, guestCount } = req.query;

        if (!restaurantId || !date || !startTime || !guestCount) {
            return res.status(400).json({ success: false, message: "Missing required parameters" });
        }

        const guests = parseInt(guestCount);
        // Standard duration of 1 hour + 15 min buffer
        const slotDurationMins = 60 + 15;

        const reqStartMins = extractMins(startTime);
        const reqEndMins = reqStartMins + slotDurationMins;

        // formatting request end time back to HH:mm for overlap query
        const reqEndHours = Math.floor(reqEndMins / 60).toString().padStart(2, "0");
        const reqEndMinsStr = (reqEndMins % 60).toString().padStart(2, "0");
        const endTime = `${reqEndHours}:${reqEndMinsStr}`;

        const tables = await DiningTable.find({
            restaurantId,
            isActive: true,
            capacity: { $gte: guests },
        });

        if (tables.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    tables: [],
                    availableTables: [],
                    requestedSlot: { startTime, endTime },
                },
            });
        }

        const tableIds = tables.map((t) => t._id);

        const overlappingBookings = await Reservation.find({
            tableId: { $in: tableIds },
            bookingDate: date,
            status: { $nin: ["cancelled", "no-show"] },
            startTime: { $lt: endTime },
            endTime: { $gt: startTime },
        });

        const bookedTableIds = overlappingBookings.map((b) => b.tableId.toString());

        // Mark each table as booked or not
        const allTables = tables.map(t => {
            const tableObj = t.toObject ? t.toObject() : t;
            return {
                ...tableObj,
                isBooked: bookedTableIds.includes(t._id.toString())
            };
        });

        // For backward compatibility keep availableTables (optional but safer)
        const availableTables = allTables.filter(t => !t.isBooked);

        res.status(200).json({
            success: true,
            data: {
                tables: allTables,
                availableTables,
                requestedSlot: { startTime, endTime },
            },
        });
    } catch (error) {
        console.error("Error finding available tables:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// POST /api/book-table
export const bookTable = async (req, res) => {
    try {
        const { tableId, date, startTime, guestCount, specialRequest } = req.body;
        // Assuming userId is extracted from JWT middleware
        const userId = req.user?.id || req.body.userId;

        if (!tableId || !date || !startTime || !guestCount || !userId) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Validate Table
        const table = await DiningTable.findById(tableId);
        if (!table || !table.isActive) {
            return res.status(404).json({ success: false, message: "Table not found or inactive" });
        }

        if (table.capacity < parseInt(guestCount)) {
            return res.status(400).json({ success: false, message: "Table capacity is too small for guest count" });
        }

        // Verify Restaurant allows dining
        const restaurant = await Restaurant.findById(table.restaurantId);
        // Assuming schema was updated to handle diningEnabled flag, otherwise ignore
        if (restaurant && restaurant.diningEnabled === false) {
            return res.status(400).json({ success: false, message: "Dining reservation is disabled for this restaurant" });
        }

        const slotDurationMins = 60 + 15; // 1 hr + buffer
        const startMins = extractMins(startTime);
        const endMins = startMins + slotDurationMins;
        const endHours = Math.floor(endMins / 60).toString().padStart(2, "0");
        const endMinsStr = (endMins % 60).toString().padStart(2, "0");
        const endTime = `${endHours}:${endMinsStr}`;

        // Revalidate Availability defensively against race conditions
        const existingOverlaps = await Reservation.find({
            tableId: tableId,
            bookingDate: date,
            status: { $nin: ["cancelled", "no-show"] },
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
        });

        if (existingOverlaps.length > 0) {
            return res.status(409).json({ success: false, message: "Table is no longer available for this time slot" });
        }

        // In a real production system, use a MongoDB Transaction session here to prevent race conditions during insertion
        // const session = await mongoose.startSession();
        // session.startTransaction();

        const reservation = new Reservation({
            userId,
            restaurantId: table.restaurantId,
            tableId,
            bookingDate: date,
            startTime,
            endTime,
            guestCount: parseInt(guestCount),
            specialRequest: specialRequest || "",
            status: "confirmed" // Auto-confirm for now to match old system
        });

        await reservation.save();

        res.status(201).json({
            success: true,
            message: "Table reservation created successfully",
            data: reservation
        });
    } catch (error) {
        console.error("Error booking table:", error);
        // Check if error is due to compound unique index violation (E11000)
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "Table is no longer available for this time slot" });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
