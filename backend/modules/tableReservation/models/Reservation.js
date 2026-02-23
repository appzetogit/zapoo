import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant",
            required: true,
            index: true,
        },
        tableId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DiningTable",
            required: true,
        },
        bookingDate: {
            type: String, // Stored as YYYY-MM-DD
            required: true,
        },
        startTime: {
            type: String, // Stored as HH:mm (24-hour format)
            required: true,
        },
        endTime: {
            type: String, // Stored as HH:mm (24-hour format)
            required: true,
        },
        guestCount: {
            type: Number,
            required: true,
            min: 1,
        },
        specialRequest: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: ["pending", "confirmed", "completed", "cancelled", "no-show"],
            default: "pending",
        },
    },
    { timestamps: true }
);

// Unique compound index to prevent double booking of the same table at the same time
reservationSchema.index({ tableId: 1, bookingDate: 1, startTime: 1 }, { unique: true });

const Reservation = mongoose.model("Reservation", reservationSchema);
export default Reservation;
