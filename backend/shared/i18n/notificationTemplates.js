import { DEFAULT_LOCALE, normalizeLocale } from './localeConstants.js';
import { translateText } from './translationService.js';

const notificationTemplates = {
  user_order_update: {
    title: 'Order Update',
    body: ({ orderId, status }) => `Your order #${orderId} status is now ${status}`
  },
  user_order_delivered: {
    title: 'Order Delivered!',
    body: () => 'Your food has arrived! Enjoy your meal.'
  },
  user_order_out_for_delivery: {
    title: 'Order Out for Delivery',
    body: () => 'Our delivery partner is on the way!'
  },
  user_order_cancelled: {
    title: 'Order Cancelled',
    body: () => 'Your order has been cancelled.'
  },
  user_order_accepted: {
    title: 'Order Accepted',
    body: () => 'The restaurant is preparing your food.'
  },
  user_order_ready: {
    title: 'Order Ready',
    body: () => 'Your food is ready for pickup.'
  },
  user_order_placed: {
    title: 'Order Placed Successfully!',
    body: ({ orderId }) => `Your order #${orderId} has been placed. Waiting for restaurant to prepare.`
  },
  user_payment_success: {
    title: 'Payment Successful! Order Confirmed',
    body: ({ orderId }) => `Your order #${orderId} has been confirmed.`
  },
  restaurant_new_order: {
    title: 'New Order Received!',
    body: ({ orderId, total }) => `Order #${orderId} for ₹${total ?? 0}`
  },
  delivery_new_order: {
    title: 'New Order Assigned',
    body: ({ orderId, restaurantName }) => `Order #${orderId} from ${restaurantName || 'restaurant'}`
  },
  delivery_order_ready_for_pickup: {
    title: 'Order Ready for Pickup',
    body: ({ orderId }) => `Order #${orderId} is ready for pickup`
  }
};

export async function renderNotificationTemplate(key, vars = {}, locale = DEFAULT_LOCALE) {
  const template = notificationTemplates[key];
  if (!template) {
    return {
      title: vars.title || '',
      body: vars.body || ''
    };
  }

  const normalizedLocale = normalizeLocale(locale);
  const englishTitle = typeof template.title === 'function' ? template.title(vars) : template.title;
  const englishBody = typeof template.body === 'function' ? template.body(vars) : template.body;

  if (normalizedLocale === 'en') {
    return {
      title: englishTitle,
      body: englishBody
    };
  }

  return {
    title: await translateText(englishTitle, normalizedLocale, 'en'),
    body: await translateText(englishBody, normalizedLocale, 'en')
  };
}
