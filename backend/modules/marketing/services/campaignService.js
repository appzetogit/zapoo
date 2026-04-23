import AdRequest from '../models/AdRequest.js';

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

const getISTDayBoundsFromDate = (date) => {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();
    const day = shifted.getUTCDate();

    const startUtcMs = Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS;
    const endUtcMs = Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS;

    return {
        dayStart: new Date(startUtcMs),
        dayEnd: new Date(endUtcMs)
    };
};

/**
 * Service to automatically transition campaign statuses based on current date
 */
export const syncCampaignStatuses = async () => {
    const now = new Date();
    const { dayStart, dayEnd } = getISTDayBoundsFromDate(now);
    const summary = { activated: 0, completed: 0 };

    try {
        // 1. Scheduled -> Active (if start date reached and paid)
        const toActivate = await AdRequest.updateMany(
            {
                status: { $in: ['Approved', 'Scheduled'] },
                startDate: { $lte: dayEnd },
                endDate: { $gte: dayStart },
                paymentStatus: 'Paid'
            },
            { status: 'Active' }
        );
        summary.activated = toActivate.modifiedCount;

        // 2. Active -> Completed (if end date passed)
        const toComplete = await AdRequest.updateMany(
            {
                status: 'Active',
                endDate: { $lt: dayStart }
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
