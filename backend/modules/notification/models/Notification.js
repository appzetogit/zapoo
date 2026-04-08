import mongoose from 'mongoose';
import { localizedTextSchema } from '../../../shared/i18n/localizedText.js';

/**
 * Notification — a sent notification visible to users.
 * Created by admin (direct or on approval of a restaurant request).
 */
const notificationSchema = new mongoose.Schema(
    {
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
        localizedTitle: {
            type: localizedTextSchema,
            default: () => ({ en: '', hi: '', bn: '' })
        },
        localizedDescription: {
            type: localizedTextSchema,
            default: () => ({ en: '', hi: '', bn: '' })
        },
        imageUrl: {
            type: String,
            default: null,
        },
        targetZone: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Zone',
            default: null,
        },
        // 'all_users' for now; can be extended to all_delivery / all_restaurants
        target: {
            type: String,
            enum: ['all_users', 'all_delivery', 'all_restaurants'],
            default: 'all_users',
        },
        sourceType: {
            type: String,
            enum: ['admin_direct', 'restaurant_request'],
            required: true,
        },
        // Populated only when sourceType === 'restaurant_request'
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant',
            default: null,
        },
        // Denormalized snapshot for read-time range filtering (restaurant_request only)
        restaurantLocation: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number] },
        },
        deliveryRangeKm: {
            type: Number,
            default: null,
        },
        sentAt: {
            type: Date,
            default: Date.now,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

notificationSchema.index({ target: 1, sentAt: -1 });
notificationSchema.index({ isActive: 1, sentAt: -1 });

export default mongoose.model('Notification', notificationSchema);
