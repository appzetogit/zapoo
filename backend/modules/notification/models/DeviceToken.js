import mongoose from 'mongoose';

const deviceTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'role' // Dynamic ref based on role
    },
    role: {
        type: String,
        required: true,
        enum: ['user', 'restaurant', 'delivery', 'admin']
    },
    deviceToken: {
        type: String,
        required: true,
        trim: true
    },
    platform: {
        type: String,
        enum: ['web', 'android', 'ios'],
        default: 'web'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Create indexes for faster lookups
deviceTokenSchema.index({ userId: 1, role: 1 });
deviceTokenSchema.index({ userId: 1, role: 1, deviceToken: 1 }, { unique: true });
deviceTokenSchema.index({ deviceToken: 1 });

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);
export default DeviceToken;
