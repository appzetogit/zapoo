import mongoose from 'mongoose';

const relationshipRequestSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    time: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'in_progress'],
      default: 'pending',
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('RelationshipRequest', relationshipRequestSchema);
