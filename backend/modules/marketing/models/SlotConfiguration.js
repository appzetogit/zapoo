import mongoose from 'mongoose';

const slotConfigurationSchema = new mongoose.Schema(
    {
        zone: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Zone',
            required: true,
            unique: true
        },
        maxSlots: {
            type: Number,
            required: true,
            default: 5,
            min: 1
        },
        isActive: {
            type: Boolean,
            default: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model('SlotConfiguration', slotConfigurationSchema);
