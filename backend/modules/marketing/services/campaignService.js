import AdRequest from '../models/AdRequest.js';

/**
 * Service to automatically transition campaign statuses based on current date
 */
export const syncCampaignStatuses = async () => {
    const now = new Date();
    const summary = { activated: 0, completed: 0 };

    try {
        // 1. Scheduled -> Active (if start date reached and paid)
        const toActivate = await AdRequest.updateMany(
            {
                status: { $in: ['Approved', 'Scheduled'] },
                startDate: { $lte: now },
                endDate: { $gte: now },
                paymentStatus: 'Paid'
            },
            { status: 'Active' }
        );
        summary.activated = toActivate.modifiedCount;

        // 2. Active -> Completed (if end date passed)
        const toComplete = await AdRequest.updateMany(
            {
                status: 'Active',
                endDate: { $lt: now }
            },
            { status: 'Completed' }
        );
        summary.completed = toComplete.modifiedCount;

        return summary;
    } catch (error) {
        console.error('Error syncing campaign statuses:', error);
        throw error;
    }
};
