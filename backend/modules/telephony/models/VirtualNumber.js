import mongoose from "mongoose";

const virtualNumberSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["free", "allocated"],
      default: "free",
      index: true,
    },
    allocated_order_id: {
      type: String,
      index: true,
      default: null,
    },
    allocated_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

virtualNumberSchema.index({ city: 1, status: 1 });

export default mongoose.model("VirtualNumber", virtualNumberSchema);

