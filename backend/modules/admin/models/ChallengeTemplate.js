import mongoose from 'mongoose';

const challengeTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    metricKey: {
      type: String,
      required: true,
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
    targetType: {
      type: String,
      required: true,
      enum: ['restaurant', 'delivery_partner'],
      index: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
  }
);

challengeTemplateSchema.index({ targetType: 1, metricKey: 1 }, { unique: true });

const ChallengeTemplate = mongoose.model('ChallengeTemplate', challengeTemplateSchema);

export default ChallengeTemplate;
