
import mongoose from "mongoose";

const tierSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        minArea: {
            type: Number,
            required: true,
            min: 0,
        },
        maxArea: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            trim: true,
        },
        rank: {
            type: Number,
            required: true,
            unique: true, // 1 for Tier 1, 2 for Tier 2, etc.
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        deliveryPricing: {
            baseFee: {
                type: Number,
                default: 0,
                min: 0,
            },
            freeDeliveryThreshold: {
                type: Number,
                default: 0,
                min: 0,
            },
        },
        maxBanners: {
            type: Number,
            default: 5,
            min: 1,
            // Max number of concurrent approved ads per day for zones in this tier
        },
        recommendedItemFee: {
            type: Number,
            default: 0,
            min: 0,
            comment: 'Default fee for recommended items in this tier'
        },
    },
    {
        timestamps: true,
    }
);

// Ensure minArea < maxArea
tierSchema.pre("validate", function (next) {
    if (this.minArea >= this.maxArea) {
        next(new Error("minArea must be less than maxArea"));
    } else {
        next();
    }
});

const Tier = mongoose.model("Tier", tierSchema);

export default Tier;
