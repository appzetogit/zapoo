import mongoose from 'mongoose';

/**
 * NotificationRequest — a restaurant-submitted request asking admin to
 * send a push notification to users.
 */
const notificationRequestSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
        imageUrl: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        // Set when admin approves — links to the Notification that was sent
        sentNotificationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Notification',
            default: null,
        },
    },
    { timestamps: true }
);

// Index to efficiently count today's requests for a restaurant (daily limit check)
notificationRequestSchema.index({ restaurantId: 1, createdAt: -1 });

export default mongoose.model('NotificationRequest', notificationRequestSchema);
