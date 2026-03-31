import mongoose from "mongoose";

const callSessionSchema = new mongoose.Schema(
  {
    order_id: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    caller_user_id: {
      type: String,
      required: true,
      trim: true,
    },
    receiver_user_id: {
      type: String,
      required: true,
      trim: true,
    },
    caller_role: {
      type: String,
      enum: ["restaurant", "delivery_partner", "customer", "admin"],
      required: true,
    },
    receiver_role: {
      type: String,
      enum: ["restaurant", "delivery_partner", "customer", "admin"],
      required: true,
    },
    virtual_number: {
      type: String,
      required: true,
      trim: true,
    },
    restaurant_phone: {
      type: String,
      trim: true,
      default: null,
    },
    delivery_partner_phone: {
      type: String,
      trim: true,
      default: null,
    },
    customer_phone: {
      type: String,
      trim: true,
      default: null,
    },
    caller_phone: {
      type: String,
      required: true,
      trim: true,
    },
    receiver_phone: {
      type: String,
      required: true,
      trim: true,
    },
    call_sid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "ringing",
        "answered",
        "completed",
        "failed",
        "busy",
        "no_answer",
        "cancelled",
      ],
      default: "initiated",
      index: true,
    },
    direction: {
      type: String,
      enum: [
        "restaurant_to_dp",
        "dp_to_restaurant",
        "restaurant_to_customer",
        "customer_to_restaurant",
        "customer_to_dp",
        "dp_to_customer",
        "other",
      ],
      required: true,
    },
    duration: {
      type: Number,
      default: null,
    },
    started_at: {
      type: Date,
      default: Date.now,
    },
    ended_at: {
      type: Date,
      default: null,
    },
    cost: {
      type: Number,
      default: null,
    },
    raw_webhook_payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

callSessionSchema.index({ order_id: 1, virtual_number: 1 });

export default mongoose.model("CallSession", callSessionSchema);

