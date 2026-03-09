import mongoose from 'mongoose';

const challengeProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    userType: {
      type: String,
      enum: ['restaurant', 'delivery_partner'],
      required: true,
      index: true
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true
    },
    cycleKey: {
      type: String,
      required: true,
      index: true
    },
    cycleStart: {
      type: Date,
      required: true
    },
    cycleEnd: {
      type: Date,
      required: true
    },
    currentProgress: {
      type: Number,
      default: 0
    },
    processedEventKeys: {
      type: [String],
      default: []
    },
    targetValue: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true
    },
    rewardStatus: {
      type: String,
      enum: ['none', 'pending', 'issuing', 'issued'],
      default: 'none'
    },
    rewardAmount: {
      type: Number,
      default: 0
    },
    rewardGranted: {
      type: Boolean,
      default: false,
      index: true
    },
    rewardGrantedAt: Date,
    rewardType: {
      type: String,
      default: null
    },
    rewardValue: {
      type: Number,
      default: 0
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    completedAt: Date,
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

challengeProgressSchema.index(
  { userId: 1, challengeId: 1, cycleKey: 1 },
  { unique: true }
);
challengeProgressSchema.index({ challengeId: 1, cycleKey: 1, status: 1 });
challengeProgressSchema.index({ userId: 1, lastUpdated: -1 });

const ChallengeProgress = mongoose.model('ChallengeProgress', challengeProgressSchema);

export default ChallengeProgress;
