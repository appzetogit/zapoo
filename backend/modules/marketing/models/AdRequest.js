import mongoose from 'mongoose';

const adRequestSchema = new mongoose.Schema(
    {
        restaurant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant',
            required: true
        },
        bannerImage: {
            type: String,
            required: false
        },
        targetZones: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Zone',
            required: true
        }],
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        redirectTarget: {
            type: String,
            required: true,
            default: 'menu' // e.g., 'menu', 'offers', 'restaurant'
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Scheduled', 'Active', 'Completed', 'Rejected', 'Banner Pending'],
            default: 'Pending'
        },
        paymentStatus: {
            type: String,
            enum: ['Pending', 'Paid', 'Failed'],
            default: 'Pending'
        },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
        totalCost: {
            type: Number,
            required: true
        },
        rejectionReason: {
            type: String
        },
        metrics: {
            impressions: { type: Number, default: 0 },
            clicks: { type: Number, default: 0 },
            orders: { type: Number, default: 0 }
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        approvalDate: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Indexes for performance
adRequestSchema.index({ status: 1 });
adRequestSchema.index({ targetZones: 1 });
adRequestSchema.index({ startDate: 1, endDate: 1 });
adRequestSchema.index({ restaurant: 1 });

export default mongoose.model('AdRequest', adRequestSchema);
