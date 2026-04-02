import mongoose from "mongoose";

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
    description: {
      type: String,
      default: "",
      trim: true,
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
