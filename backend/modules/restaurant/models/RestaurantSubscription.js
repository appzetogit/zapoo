import mongoose from 'mongoose';

const restaurantSubscriptionSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    trialUsed: {
      type: Boolean,
      default: false,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      alias: 'payment_status',
    },
    paymentDate: {
      type: Date,
      default: null,
      alias: 'payment_date',
    },
    amount: {
      type: Number,
      required: true,
    },
    razorpayOrderId: {
      type: String,
      sparse: true,
      alias: 'razorpay_order_id',
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      alias: 'razorpay_payment_id',
    },
    razorpaySignature: {
      type: String,
      sparse: true,
      alias: 'razorpay_signature',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

restaurantSubscriptionSchema.index({ restaurantId: 1, createdAt: -1 });
restaurantSubscriptionSchema.index({ restaurantId: 1, status: 1, endDate: -1 });
restaurantSubscriptionSchema.index({ paymentStatus: 1, paymentDate: -1 });
restaurantSubscriptionSchema.index({ razorpayOrderId: 1 });
restaurantSubscriptionSchema.index({ razorpayPaymentId: 1 });

export default mongoose.model('RestaurantSubscription', restaurantSubscriptionSchema);
