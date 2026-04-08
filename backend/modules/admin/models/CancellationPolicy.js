import mongoose from 'mongoose';
import { localizedTextSchema } from '../../../shared/i18n/localizedText.js';

const cancellationPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Cancellation Policy',
      trim: true
    },
    localizedTitle: {
      type: localizedTextSchema,
      default: () => ({ en: 'Cancellation Policy', hi: '', bn: '' })
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
cancellationPolicySchema.index({ isActive: 1 });

export default mongoose.model('CancellationPolicy', cancellationPolicySchema);
