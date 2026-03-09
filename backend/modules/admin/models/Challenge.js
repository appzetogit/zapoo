import mongoose from 'mongoose';

const challengeSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChallengeTemplate',
      index: true
    },
    challengeName: {
      type: String,
      required: true,
      trim: true
    },
    applicableUserType: {
      type: String,
      enum: ['restaurant', 'delivery_partner'],
      required: true,
      index: true
    },
    tierIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tier'
      }],
      default: []
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
      index: true
    },
    metricKey: {
      type: String,
      enum: [
        'order_count',
        'order_revenue',
        'average_rating',
        'new_customer_count',
        'delivery_count',
        'acceptance_rate',
        'active_days',
        'weekly_delivery_count'
      ],
      index: true
    },
    metricType: {
      type: String,
      enum: ['completed_orders', 'completed_deliveries', 'total_revenue'],
      index: true
    },
    operator: {
      type: String,
      enum: ['>=', '<=', '=='],
      default: '>='
    },
    targetValue: {
      type: Number,
      required: true,
      min: 0
    },
    rewardType: {
      type: String,
      enum: ['wallet', 'bonus', 'badge', 'wallet_credit', 'featured_listing', 'ad_credits', 'top_10', 'free_banner'],
      required: true
    },
    rewardValue: {
      type: Number,
      required: true,
      min: 0
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    }
  },
  {
    timestamps: true
  }
);

challengeSchema.index({ applicableUserType: 1, status: 1, startDate: 1, endDate: 1 });
challengeSchema.index({ applicableUserType: 1, metricKey: 1, status: 1, startDate: 1, endDate: 1 });
challengeSchema.index({ tierIds: 1, status: 1 });

challengeSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    return next(new Error('endDate must be after startDate'));
  }

  if (!this.metricKey && this.metricType) {
    const map = {
      completed_orders: 'order_count',
      completed_deliveries: 'delivery_count',
      total_revenue: 'order_revenue'
    };
    this.metricKey = map[this.metricType];
  }

  if (!this.metricType && this.metricKey) {
    const reverseMap = {
      order_count: 'completed_orders',
      delivery_count: 'completed_deliveries',
      weekly_delivery_count: 'completed_deliveries',
      order_revenue: 'total_revenue'
    };
    if (reverseMap[this.metricKey]) {
      this.metricType = reverseMap[this.metricKey];
    }
  }

  if (!Array.isArray(this.tierIds)) {
    this.tierIds = [];
  }

  next();
});

const Challenge = mongoose.model('Challenge', challengeSchema);

export default Challenge;
