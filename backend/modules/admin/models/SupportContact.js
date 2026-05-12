import mongoose from 'mongoose';

const supportContactSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      default: 'zapoosupport@gmail.com',
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: '8919142335',
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

supportContactSchema.index({ updatedAt: -1 });

export default mongoose.model('SupportContact', supportContactSchema);
