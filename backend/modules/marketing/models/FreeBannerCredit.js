import mongoose from 'mongoose';

const freeBannerCreditSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    challengeProgressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChallengeProgress',
      required: true,
      unique: true,
      index: true
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      default: null
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'consumed'],
      default: 'available',
      index: true
    },
    earnedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    reservedAt: {
      type: Date,
      default: null
    },
    consumedAt: {
      type: Date,
      default: null
    },
    reservedForAdRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdRequest',
      default: null,
      index: true
    },
    consumedByAdRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdRequest',
      default: null
    }
  },
  {
    timestamps: true
  }
);

freeBannerCreditSchema.index({ restaurant: 1, status: 1, earnedAt: 1 });

export default mongoose.model('FreeBannerCredit', freeBannerCreditSchema);
