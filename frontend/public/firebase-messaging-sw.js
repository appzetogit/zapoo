// Firebase Messaging Service Worker
// This file MUST be in the public/ root directory (served from /)
// It handles background push notifications when the app tab is closed/minimized

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAO32xTBf-xq4cjzRfbtzyCUny8zY_j3WM",
    authDomain: "zapoo-d23ea.firebaseapp.com",
    projectId: "zapoo-d23ea",
    storageBucket: "zapoo-d23ea.firebasestorage.app",
    messagingSenderId: "152641542029",
    appId: "1:152641542029:web:6f0fec400684654c95cfc4",
});

const messaging = firebase.messaging();
const PENDING_OFFER_KEY = 'deliveryPendingOffer';

const rolePrefixMap = {
    user: '[USER]',
    restaurant: '[RESTAURANT]',
    delivery: '[DELIVERY PARTNER]',
    admin: '[ADMIN]',
};

function ensureRolePrefix(rawTitle, targetRole) {
    const title = String(rawTitle || 'Zapoo').trim();
    if (title.startsWith('[')) return title;
    const prefix = rolePrefixMap[targetRole] || '[NOTIFICATION]';
    return `${prefix} ${title}`;
}

function savePendingDeliveryOffer(data = {}) {
    const orderKey = String(data.orderMongoId || data.orderId || '').trim();
    if (!orderKey) return;
    try {
        const offerExpiresAt = data.offerExpiresAt || null;
        localStorage.setItem(PENDING_OFFER_KEY, JSON.stringify({
            orderKey,
            orderId: data.orderId || null,
            orderMongoId: data.orderMongoId || null,
            offerExpiresAt,
            savedAt: Date.now(),
            source: 'fcm_sw',
        }));
    } catch (err) {
        console.warn('[SW] Failed to persist pending delivery offer:', err?.message || err);
    }
}

function buildDeliveryClickUrl(data = {}) {
    const orderMongoId = data.orderMongoId || data.orderId;
    if (!orderMongoId) return '/food/delivery/feed';
    return `/food/delivery/feed?orderId=${encodeURIComponent(orderMongoId)}`;
}

messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const { title, body, image } = payload.notification || {};
    const data = payload.data || {};
    const notificationId = data.notificationId || `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const type = String(data.type || '').toLowerCase();
    const isDeliveryOffer = data.target === 'delivery' && ['new_order', 'new_order_available'].includes(type);

    if (isDeliveryOffer) {
        savePendingDeliveryOffer(data);
    }

    const iconMap = {
        restaurant: '/zapoo-restaurant-icon.png',
        delivery: '/zapoo-delivery-icon.png',
        user: '/zapoo-logo.png',
        admin: '/zapoo-logo.png',
    };
    const icon = iconMap[data.target] || '/zapoo-logo.png';

    const notificationTitle = ensureRolePrefix(title || data.title || 'Zapoo', data.target);
    const orderTagKey = data.orderMongoId || data.orderId || notificationId;
    const notificationOptions = {
        body: body || data.body || '',
        icon,
        badge: icon,
        ...((image || data.imageUrl) && String(image || data.imageUrl).startsWith('http')
            ? { image: image || data.imageUrl }
            : {}),
        actions: [],
        vibrate: [250, 120, 250, 120, 250],
        tag: isDeliveryOffer ? `delivery-order-${orderTagKey}` : `zapoo-${data.target || 'user'}-${notificationId}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: {
            url: data.clickUrl || buildDeliveryClickUrl(data),
            notificationId,
            orderMongoId: data.orderMongoId || null,
            orderId: data.orderId || null,
            type,
            target: data.target || 'user',
        },
    };

    return self.registration.showNotification(notificationTitle, notificationOptions)
        .then(() => {
            console.log('[SW] showNotification success:', {
                title: notificationTitle,
                tag: notificationOptions.tag,
            });
        })
        .catch((err) => {
            console.error('[SW] showNotification failed:', err?.message || err, {
                title: notificationTitle,
                options: notificationOptions,
                permission: Notification?.permission,
            });
        });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    const targetUrl = data.url || buildDeliveryClickUrl(data) || '/food/delivery/feed';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.postMessage({
                        type: 'delivery-offer-click',
                        orderMongoId: data.orderMongoId,
                        orderId: data.orderId,
                        url: targetUrl,
                    });
                    if (client.url.includes('/delivery') || client.url.includes('/food/delivery')) {
                        return client.focus();
                    }
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
