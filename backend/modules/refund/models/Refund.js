import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  refundId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  paymentId: {
    type: String,
    required: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    index: true,
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
    index: true
  },
  reason: {
    type: String,
    default: null
  },
  notes: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  },
  webhookEventHistory: [{
    event: {
      type: String,
      required: true
    },
    receivedAt: {
      type: Date,
      default: Date.now
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  }]
}, {
  timestamps: true
});

refundSchema.index({ paymentId: 1, createdAt: -1 });
refundSchema.index({ orderId: 1, createdAt: -1 });

const Refund = mongoose.model('Refund', refundSchema);

export default Refund;
