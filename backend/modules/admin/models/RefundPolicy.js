import mongoose from 'mongoose';
import { localizedTextSchema } from '../../../shared/i18n/localizedText.js';

const refundPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Refund Policy',
      trim: true
    },
    localizedTitle: {
      type: localizedTextSchema,
      default: () => ({ en: 'Refund Policy', hi: '', bn: '' })
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
refundPolicySchema.index({ isActive: 1 });

export default mongoose.model('RefundPolicy', refundPolicySchema);
