import mongoose from 'mongoose';

const challengeBannerSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Zone',
      required: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    title: {
      type: String,
      trim: true,
      default: 'Challenge Reward'
    },
    description: {
      type: String,
      trim: true,
      default: 'You earned this spotlight!'
    },
    bannerImage: {
      type: String,
      default: null
    },
    redirectTarget: {
      type: String,
      default: 'menu',
      enum: ['menu', 'offers', 'restaurant', 'home']
    },
    challengeProgressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChallengeProgress',
      default: null
    }
  },
  { timestamps: true }
);

challengeBannerSchema.index({ zoneId: 1, startDate: 1, endDate: 1 });

export default mongoose.model('ChallengeBanner', challengeBannerSchema);
