import mongoose from 'mongoose';

const top10RestaurantSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    unique: true,
    index: true
  },
  rank: {
    type: Number,
    required: true,
    min: 1,
    max: 20
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    enum: ['curated', 'challenge'],
    default: 'curated',
    index: true
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
top10RestaurantSchema.index({ rank: 1, isActive: 1 });
top10RestaurantSchema.index({ order: 1, isActive: 1 });

// Ensure only 10 curated (non-challenge) slots; challenge entries are unlimited and time-bound via expiresAt
top10RestaurantSchema.pre('save', async function(next) {
  if (this.source === 'challenge') return next(); // No limit for challenge entries
  if (!this.isActive) return next();

  const now = new Date();
  const query = {
    isActive: true,
    source: { $ne: 'challenge' },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  };
  if (this.isNew) {
    const count = await mongoose.model('Top10Restaurant').countDocuments(query);
    if (count >= 10) return next(new Error('Maximum 10 curated restaurants can be active in Top 10'));
  } else if (this.isModified('isActive') || this.isModified('expiresAt') || this.isModified('source')) {
    const count = await mongoose.model('Top10Restaurant').countDocuments({
      ...query,
      _id: { $ne: this._id }
    });
    if (count >= 10) return next(new Error('Maximum 10 curated restaurants can be active in Top 10'));
  }
  next();
});

export default mongoose.model('Top10Restaurant', top10RestaurantSchema);

