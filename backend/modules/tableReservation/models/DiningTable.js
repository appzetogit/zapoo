import mongoose from "mongoose";

const diningTableSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Restaurant", // Assuming existing Restaurant model is named 'Restaurant'
            required: true,
            index: true,
        },
        tableNumber: {
            type: String,
            required: true,
        },
        capacity: {
            type: Number,
            required: true,
            min: 1,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Ensure table numbers are unique per restaurant
diningTableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

const DiningTable = mongoose.model("DiningTable", diningTableSchema);
export default DiningTable;
