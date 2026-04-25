import Admin from '../../admin/models/Admin.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import { sendNotificationToUser } from '../../notification/utils/pushNotificationHelper.js';

export const notifyAdminsAdPaymentCompleted = async (ad) => {
  try {
    if (!ad?._id) return;

    const [activeAdmins, restaurant] = await Promise.all([
      Admin.find({ isActive: true }).select('_id').lean(),
      ad?.restaurant
        ? Restaurant.findById(ad.restaurant).select('_id name').lean()
        : Promise.resolve(null)
    ]);

    if (!Array.isArray(activeAdmins) || activeAdmins.length === 0) {
      return;
    }

    const adId = String(ad._id);
    const restaurantId = restaurant?._id ? String(restaurant._id) : '';
    const restaurantName = restaurant?.name || 'A restaurant';
    const title = 'Banner payment received';
    const body = `${restaurantName} completed banner payment. Please upload/assign the banner.`;

    await Promise.allSettled(
      activeAdmins.map((admin) =>
        sendNotificationToUser(
          String(admin._id),
          'admin',
          title,
          body,
          {
            notificationType: 'ad_payment_completed',
            adId,
            restaurantId,
            clickUrl: '/admin/marketing/ad-requests'
          }
        )
      )
    );
  } catch (error) {
    console.error('[AD_PAYMENT_ADMIN_NOTIFY] Failed to notify admins:', error?.message || error);
  }
};
