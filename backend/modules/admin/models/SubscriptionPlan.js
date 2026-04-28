import mongoose from "mongoose";
import { FEATURE_KEY_SET, normalizeFeatureKey } from "../../subscription/constants/featureCatalog.js";

const subscriptionPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        pricing: {
            tier1: { type: Number, required: true, default: 0 },
            tier2: { type: Number, required: true, default: 0 },
            tier3: { type: Number, required: true, default: 0 },
            tier4: { type: Number, required: true, default: 0 }
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
                lowercase: true,
                validate: {
                    validator: (value) => FEATURE_KEY_SET.has(normalizeFeatureKey(value)),
                    message: (props) => `${props.value} is not a valid feature key`,
                },
            },
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
