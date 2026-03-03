import { useEffect, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from '@/lib/firebaseConfig';
import apiClient from '@/lib/api';

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
// Token is refreshed at most once every 24h per browser session
const TOKEN_CACHE_KEY = 'fcm_token_registered_at';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * useFCMNotification
 *
 * Call inside the user layout (or any user-facing component) when the user
 * is logged in.  Handles:
 *   1. Requesting notification permission from the browser
 *   2. Getting the FCM token via the VAPID key
 *   3. POST-ing the token to /api/user/fcm-token so the backend can target it
 *   4. onMessage handler for foreground messages (in-tab)
 */
export function useFCMNotification({ isLoggedIn = false } = {}) {
    const initialized = useRef(false);

    useEffect(() => {
        if (!isLoggedIn) return;
        if (initialized.current) return;
        initialized.current = true;

        (async () => {
            try {
                // ── 1. Check browser support ────────────────────────────────
                if (!('Notification' in window) || !('serviceWorker' in navigator)) {
                    console.log('[FCM] Push notifications not supported in this browser.');
                    return;
                }

                // ── 2. Request permission ───────────────────────────────────
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.log('[FCM] Notification permission denied by user.');
                    return;
                }

                // ── 3. Get messaging instance ───────────────────────────────
                const messaging = await getFirebaseMessaging();
                if (!messaging) {
                    console.log('[FCM] Messaging not supported.');
                    return;
                }

                // ── 4. Register SW and get FCM token ────────────────────────
                let swReg;
                try {
                    swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    console.log('[FCM] Service worker registered:', swReg.scope);
                } catch (swErr) {
                    console.warn('[FCM] SW registration failed:', swErr.message);
                    return;
                }

                const token = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: swReg,
                });

                if (!token) {
                    console.warn('[FCM] Failed to get FCM token.');
                    return;
                }

                console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');

                // ── 5. Avoid sending same token to backend too often ─────────
                const lastRegistered = parseInt(localStorage.getItem(TOKEN_CACHE_KEY) || '0', 10);
                if (Date.now() - lastRegistered < TOKEN_TTL_MS) {
                    console.log('[FCM] Token recently registered, skipping API call.');
                } else {
                    // Save token to backend
                    await apiClient.post('/user/fcm-token', { token, platform: 'web' });
                    localStorage.setItem(TOKEN_CACHE_KEY, String(Date.now()));
                    console.log('[FCM] Token saved to backend.');
                }

                // ── 6. Foreground message handler ────────────────────────────
                // When app tab is focused, show browser notification for foreground FCM.
                onMessage(messaging, (payload) => {
                    const title = payload?.notification?.title || payload?.data?.title || 'Zapoo';
                    const body = payload?.notification?.body || payload?.data?.body || '';
                    const image = payload?.notification?.image || payload?.data?.imageUrl;

                    try {
                        new Notification(title, {
                            body,
                            icon: '/zapoo-icon.png',
                            ...(image ? { image } : {}),
                        });
                    } catch (notifyErr) {
                        console.warn('[FCM] Foreground notification display failed:', notifyErr.message);
                    }
                });

            } catch (err) {
                console.warn('[FCM] Notification setup error:', err.message);
            }
        })();
    }, [isLoggedIn]);
}
