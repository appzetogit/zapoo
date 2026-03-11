import mongoose from 'mongoose';

const deliveryWalletTransactionSchema = new mongoose.Schema(
  {
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Delivery',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ['payment', 'withdrawal', 'bonus', 'deduction', 'refund', 'deposit'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
      default: 'Pending',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      sparse: true,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'card', 'cash', 'other'],
    },
    paymentCollected: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      sparse: true,
    },
    failureReason: String,
  },
  {
    timestamps: true,
  }
);

deliveryWalletTransactionSchema.index({ deliveryId: 1, createdAt: -1 });
deliveryWalletTransactionSchema.index({ deliveryId: 1, type: 1, status: 1 });
deliveryWalletTransactionSchema.index({ deliveryId: 1, orderId: 1, type: 1 });

const DeliveryWalletTransaction = mongoose.model(
  'DeliveryWalletTransaction',
  deliveryWalletTransactionSchema
);

export default DeliveryWalletTransaction;

