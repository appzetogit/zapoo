// Firebase Messaging Service Worker
// This file MUST be in the public/ root directory (served from /)
// It handles background push notifications when the app tab is closed/minimized

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Must use the zapoo-d23ea project config (same project that sends FCM)
firebase.initializeApp({
    apiKey: "AIzaSyAO32xTBf-xq4cjzRfbtzyCUny8zY_j3WM",
    authDomain: "zapoo-d23ea.firebaseapp.com",
    projectId: "zapoo-d23ea",
    storageBucket: "zapoo-d23ea.firebasestorage.app",
    messagingSenderId: "152641542029",
    appId: "1:152641542029:web:6f0fec400684654c95cfc4",
});

const messaging = firebase.messaging();
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

// Handle background messages (app is closed or tab is not in focus)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const { title, body, image } = payload.notification || {};
    const data = payload.data || {};
    const notificationId = data.notificationId || `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Pick role-specific icon
    const iconMap = {
        restaurant: '/zapoo-restaurant-icon.png',
        delivery: '/zapoo-delivery-icon.png',
        user: '/zapoo-logo.png',
        admin: '/zapoo-logo.png',
    };
    const icon = iconMap[data.target] || '/zapoo-logo.png';

    const notificationTitle = ensureRolePrefix(title || data.title || 'Zapoo', data.target);
    const notificationOptions = {
        body: body || data.body || '',
        icon,
        badge: icon, // same icon for badge
        ...((image || data.imageUrl) && String(image || data.imageUrl).startsWith('http')
            ? { image: image || data.imageUrl }
            : {}),
        // Explicitly disable notification action buttons (Accept/Reject, etc.)
        actions: [],
        // Web push cannot reliably play a custom sound when the app is closed,
        // but vibration helps make background alerts more noticeable on supported devices.
        vibrate: [250, 120, 250],
        // Use per-notification tag so later pushes don't overwrite earlier ones.
        tag: `zapoo-${data.target || 'user'}-${notificationId}`,
        renotify: false,
        requireInteraction: true,
        silent: false,
        data: {
            url: data.clickUrl || '/',
            notificationId,
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

// Open the app (or focus existing tab) when notification is clicked
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus an existing tab at the target URL
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
