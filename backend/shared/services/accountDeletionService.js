import Order from '../../modules/order/models/Order.js';
import OrderSettlement from '../../modules/order/models/OrderSettlement.js';
import Payment from '../../modules/payment/models/Payment.js';
import User from '../../modules/auth/models/User.js';
import Delivery from '../../modules/delivery/models/Delivery.js';
import Restaurant from '../../modules/restaurant/models/Restaurant.js';
import UserWallet from '../../modules/user/models/UserWallet.js';
import DeviceToken from '../../modules/notification/models/DeviceToken.js';
import Feedback from '../../modules/admin/models/Feedback.js';
import FeedbackExperience from '../../modules/admin/models/FeedbackExperience.js';
import SafetyEmergency from '../../modules/admin/models/SafetyEmergency.js';
import RestaurantComplaint from '../../modules/admin/models/RestaurantComplaint.js';
import DeliveryWallet from '../../modules/delivery/models/DeliveryWallet.js';
import DeliveryWalletTransaction from '../../modules/delivery/models/DeliveryWalletTransaction.js';
import DeliveryWithdrawalRequest from '../../modules/delivery/models/DeliveryWithdrawalRequest.js';
import DeliverySupportTicket from '../../modules/admin/models/DeliverySupportTicket.js';
import RestaurantWallet from '../../modules/restaurant/models/RestaurantWallet.js';
import Menu from '../../modules/restaurant/models/Menu.js';
import Offer from '../../modules/restaurant/models/Offer.js';
import Inventory from '../../modules/restaurant/models/Inventory.js';
import RestaurantCategory from '../../modules/restaurant/models/RestaurantCategory.js';
import MenuItemSchedule from '../../modules/restaurant/models/MenuItemSchedule.js';
import OutletTimings from '../../modules/restaurant/models/OutletTimings.js';
import WithdrawalRequest from '../../modules/restaurant/models/WithdrawalRequest.js';
import StaffManagement from '../../modules/restaurant/models/StaffManagement.js';
import RelationshipRequest from '../../modules/restaurant/models/RelationshipRequest.js';
import RestaurantSubscription from '../../modules/restaurant/models/RestaurantSubscription.js';
import Notification from '../../modules/notification/models/Notification.js';
import NotificationRequest from '../../modules/notification/models/NotificationRequest.js';
import AdRequest from '../../modules/marketing/models/AdRequest.js';
import FreeBannerCredit from '../../modules/marketing/models/FreeBannerCredit.js';
import ChallengeBanner from '../../modules/marketing/models/ChallengeBanner.js';
import HeroBanner from '../../modules/heroBanner/models/HeroBanner.js';
import Top10Restaurant from '../../modules/heroBanner/models/Top10Restaurant.js';
import GourmetRestaurant from '../../modules/heroBanner/models/GourmetRestaurant.js';
import { deleteFromCloudinary } from '../utils/cloudinaryService.js';

const toIdString = (value) => (value == null ? '' : String(value).trim());

const collectRestaurantImagePublicIds = (restaurant) => {
  const ids = new Set();
  const maybeAdd = (value) => {
    const normalized = toIdString(value);
    if (normalized) ids.add(normalized);
  };

  maybeAdd(restaurant?.profileImage?.publicId);
  (restaurant?.menuImages || []).forEach((menuImage) => maybeAdd(menuImage?.publicId));
  (restaurant?.onboarding?.step2?.menuImageUrls || []).forEach((menuImage) => maybeAdd(menuImage?.publicId));
  maybeAdd(restaurant?.onboarding?.step2?.profileImageUrl?.publicId);
  maybeAdd(restaurant?.onboarding?.step3?.pan?.image?.publicId);
  maybeAdd(restaurant?.onboarding?.step3?.gst?.image?.publicId);
  maybeAdd(restaurant?.onboarding?.step3?.fssai?.image?.publicId);

  return Array.from(ids);
};

const deleteCloudinaryResources = async (publicIds = []) => {
  if (!Array.isArray(publicIds) || publicIds.length === 0) return;
  await Promise.allSettled(publicIds.map((publicId) => deleteFromCloudinary(publicId)));
};

const getOrderIdsByQuery = async (query) => {
  const orders = await Order.find(query).select('_id').lean();
  return orders.map((entry) => entry._id);
};

const deleteOrdersAndDependents = async (query, extraSettlementQuery = null) => {
  const orderIds = await getOrderIdsByQuery(query);
  const settlementDeleteQuery = orderIds.length > 0
    ? { $or: [{ orderId: { $in: orderIds } }, ...(extraSettlementQuery ? [extraSettlementQuery] : [])] }
    : (extraSettlementQuery || null);

  if (orderIds.length > 0) {
    await Promise.all([
      Payment.deleteMany({ orderId: { $in: orderIds } }),
      Order.deleteMany(query),
    ]);
  }

  if (settlementDeleteQuery) {
    await OrderSettlement.deleteMany(settlementDeleteQuery);
  }
};

export const deleteUserAccountCascade = async ({ userId }) => {
  const userObjectId = userId;
  await deleteOrdersAndDependents({ userId: userObjectId }, { userId: userObjectId });

  await Promise.all([
    UserWallet.deleteOne({ userId: userObjectId }),
    Payment.deleteMany({ userId: userObjectId }),
    Feedback.deleteMany({ userId: userObjectId }),
    FeedbackExperience.deleteMany({ userId: userObjectId }),
    SafetyEmergency.deleteMany({ userId: userObjectId }),
    RestaurantComplaint.deleteMany({ customerId: userObjectId }),
    DeviceToken.deleteMany({ userId: userObjectId, role: 'user' }),
    User.deleteOne({ _id: userObjectId }),
  ]);
};

export const deleteDeliveryAccountCascade = async ({ deliveryId }) => {
  const deliveryObjectId = deliveryId;
  await deleteOrdersAndDependents({ deliveryPartnerId: deliveryObjectId }, { deliveryPartnerId: deliveryObjectId });

  await Promise.all([
    DeliveryWallet.deleteOne({ deliveryId: deliveryObjectId }),
    DeliveryWalletTransaction.deleteMany({ deliveryId: deliveryObjectId }),
    DeliveryWithdrawalRequest.deleteMany({ deliveryId: deliveryObjectId }),
    DeliverySupportTicket.deleteMany({ deliveryId: deliveryObjectId }),
    DeviceToken.deleteMany({ userId: deliveryObjectId, role: 'delivery' }),
    Delivery.deleteOne({ _id: deliveryObjectId }),
  ]);
};

export const deleteRestaurantAccountCascade = async ({ restaurantId }) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    return { found: false };
  }

  const restaurantObjectId = restaurant._id;
  const restaurantLookupValues = Array.from(
    new Set([toIdString(restaurant._id), toIdString(restaurant.restaurantId), toIdString(restaurant.slug)].filter(Boolean))
  );
  const orderQuery = { restaurantId: { $in: restaurantLookupValues } };

  await deleteOrdersAndDependents(orderQuery, { restaurantId: restaurantObjectId });

  const imagePublicIds = collectRestaurantImagePublicIds(restaurant);
  await deleteCloudinaryResources(imagePublicIds);

  await Promise.all([
    RestaurantWallet.deleteOne({ restaurantId: restaurantObjectId }),
    Menu.deleteMany({ restaurant: restaurantObjectId }),
    Offer.deleteMany({ restaurant: restaurantObjectId }),
    Inventory.deleteMany({ restaurant: restaurantObjectId }),
    RestaurantCategory.deleteMany({ restaurant: restaurantObjectId }),
    MenuItemSchedule.deleteMany({ restaurant: restaurantObjectId }),
    OutletTimings.deleteMany({ restaurantId: restaurantObjectId }),
    WithdrawalRequest.deleteMany({ restaurantId: restaurantObjectId }),
    StaffManagement.deleteMany({
      $or: [{ restaurantId: restaurantObjectId }, { addedBy: restaurantObjectId }],
    }),
    RelationshipRequest.deleteMany({ restaurantId: restaurantObjectId }),
    RestaurantSubscription.deleteMany({ restaurantId: restaurantObjectId }),
    NotificationRequest.deleteMany({ restaurantId: restaurantObjectId }),
    Notification.deleteMany({ restaurantId: restaurantObjectId }),
    AdRequest.deleteMany({ restaurant: restaurantObjectId }),
    FreeBannerCredit.deleteMany({ restaurant: restaurantObjectId }),
    ChallengeBanner.deleteMany({ restaurant: restaurantObjectId }),
    HeroBanner.updateMany({}, { $pull: { linkedRestaurants: restaurantObjectId } }),
    Top10Restaurant.deleteMany({ restaurant: restaurantObjectId }),
    GourmetRestaurant.deleteMany({ restaurant: restaurantObjectId }),
    FeedbackExperience.deleteMany({ restaurantId: restaurantObjectId }),
    RestaurantComplaint.deleteMany({ restaurantId: restaurantObjectId }),
    DeviceToken.deleteMany({ userId: restaurantObjectId, role: 'restaurant' }),
    Restaurant.deleteOne({ _id: restaurantObjectId }),
  ]);

  return { found: true };
};
