import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        durationInDays: {
            type: Number,
            required: true,
            min: 1, // e.g., 30 for monthly, 365 for yearly
            default: 30,
        },
        features: [
            {
                type: String,
                trim: true,
            },
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
        // Optional: Zone-specific pricing can be handled here or via a separate mapping
        // For now, keeping it simple as a base plan
        zonePricing: [
            {
                zoneId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Zone",
                },
                price: {
                    type: Number,
                    required: true,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
