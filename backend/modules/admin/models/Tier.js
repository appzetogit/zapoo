
import mongoose from "mongoose";

const distanceSlabSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        minKm: {
            type: Number,
            required: true,
            min: 0,
        },
        maxKm: {
            type: Number,
            default: null,
            min: 0,
        },
        isBaseSlab: {
            type: Boolean,
            default: false,
        },
        adminPerKmRate: {
            type: Number,
            default: 0,
            min: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { _id: true },
);

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
            min: 1,
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
            basePay: {
                type: Number,
                default: 0,
                min: 0,
                comment: 'Admin base payout used when distance falls within base slab'
            },
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
            baseDistance: {
                type: Number,
                default: 3,
                min: 0,
            },
            extraKmCharge: {
                type: Number,
                default: 10,
                min: 0,
            },
            distanceSlabs: {
                type: [distanceSlabSchema],
                default: [],
                comment: "Tier-level distance slabs used for delivery pricing and settlements",
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
        platformFee: {
            type: Number,
            default: 0,
            min: 0,
            comment: 'Default platform fee for orders in this tier'
        },
        restaurantBannerPricePerDay: {
            type: Number,
            default: 500,
            min: 0,
            comment: 'Per-day banner promotion price for restaurants in this tier'
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
