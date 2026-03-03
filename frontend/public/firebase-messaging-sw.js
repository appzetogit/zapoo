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

// Handle background messages (app is closed or tab is not in focus)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const { title, body, image } = payload.notification || {};
    const data = payload.data || {};

    // Pick role-specific icon
    const iconMap = {
        restaurant: '/zapoo-restaurant-icon.png',
        delivery: '/zapoo-delivery-icon.png',
    };
    const icon = iconMap[data.target] || '/zapoo-icon.png'; // default orange (user)

    const notificationTitle = title || data.title || 'Zapoo';
    const notificationOptions = {
        body: body || data.body || '',
        icon,
        badge: icon, // same icon for badge
        image: image || data.imageUrl || undefined,
        tag: `zapoo-${data.target || 'user'}`, // separate tag per role
        renotify: true,
        data: {
            url: data.clickUrl || '/',
        },
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
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
