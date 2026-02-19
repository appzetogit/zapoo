import SlotConfiguration from '../models/SlotConfiguration.js';
import Zone from '../../admin/models/Zone.js';

export const configureSlots = async (req, res) => {
    try {
        const { zoneId, maxSlots, isActive } = req.body;

        // Verify zone exists
        const zone = await Zone.findById(zoneId);
        if (!zone) {
            return res.status(404).json({ success: false, message: 'Zone not found' });
        }

        let config = await SlotConfiguration.findOne({ zone: zoneId });

        if (config) {
            config.maxSlots = maxSlots ?? config.maxSlots;
            config.isActive = isActive ?? config.isActive;
            await config.save();
        } else {
            config = await SlotConfiguration.create({
                zone: zoneId,
                maxSlots,
                isActive,
                createdBy: req.user?._id
            });
        }

        res.status(200).json({
            success: true,
            data: config,
            message: 'Slot configuration updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSlotConfigurations = async (req, res) => {
    try {
        const configs = await SlotConfiguration.find().populate('zone', 'name zoneName');
        res.status(200).json({ success: true, data: configs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSlotsByZone = async (req, res) => {
    try {
        const { zoneId } = req.params;
        const config = await SlotConfiguration.findOne({ zone: zoneId }).populate('zone', 'name zoneName');

        if (!config) {
            return res.status(404).json({ success: false, message: 'No configuration found for this zone' });
        }

        res.status(200).json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
