import mongoose from "mongoose";
import { localizedTextSchema } from "../../../shared/i18n/localizedText.js";

const adminCouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    localizedTitle: {
      type: localizedTextSchema,
      default: () => ({ en: "", hi: "", bn: "" }),
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    localizedDescription: {
      type: localizedTextSchema,
      default: () => ({ en: "", hi: "", bn: "" }),
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    eligibilityType: {
      type: String,
      enum: ["all_users", "first_delivered_order"],
      default: "all_users",
    },
    perUserLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    globalUsageLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    globalUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    validFrom: {
      type: Date,
      default: Date.now,
      index: true,
    },
    validUntil: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

adminCouponSchema.index({ status: 1, validFrom: 1, validUntil: 1 });

export default mongoose.model("AdminCoupon", adminCouponSchema);
