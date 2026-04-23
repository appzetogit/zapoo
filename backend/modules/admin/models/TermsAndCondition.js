import mongoose from 'mongoose';
import { localizedTextSchema } from '../../../shared/i18n/localizedText.js';
import { CONTENT_MODULES, DEFAULT_CONTENT_MODULE } from '../constants/contentModules.js';

const termsAndConditionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'Terms and Conditions',
      trim: true
    },
    localizedTitle: {
      type: localizedTextSchema,
      default: () => ({ en: 'Terms and Conditions', hi: '', bn: '' })
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
    targetModule: {
      type: String,
      enum: CONTENT_MODULES,
      default: DEFAULT_CONTENT_MODULE,
      required: true,
      trim: true
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
termsAndConditionSchema.index({ isActive: 1 });
termsAndConditionSchema.index({ isActive: 1, targetModule: 1 });

export default mongoose.model('TermsAndCondition', termsAndConditionSchema);
