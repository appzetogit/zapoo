import mongoose from 'mongoose';
import { localizedTextSchema } from '../../../shared/i18n/localizedText.js';

const privacyPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Privacy Policy',
      trim: true
    },
    localizedTitle: {
      type: localizedTextSchema,
      default: () => ({ en: 'Privacy Policy', hi: '', bn: '' })
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
privacyPolicySchema.index({ isActive: 1 });

export default mongoose.model('PrivacyPolicy', privacyPolicySchema);
