import mongoose from 'mongoose';
import { localizedTextSchema } from '../../../shared/i18n/localizedText.js';

const shippingPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Shipping Policy',
      trim: true
    },
    localizedTitle: {
      type: localizedTextSchema,
      default: () => ({ en: 'Shipping Policy', hi: '', bn: '' })
    },
    content: {
      type: String,
      required: true,
      default: ''
    },
    localizedContent: {
      type: localizedTextSchema,
      default: () => ({ en: '', hi: '', bn: '' })
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
shippingPolicySchema.index({ isActive: 1 });

export default mongoose.model('ShippingPolicy', shippingPolicySchema);
