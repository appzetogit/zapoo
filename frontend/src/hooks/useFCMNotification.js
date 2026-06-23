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
export function useFCMNotification({
  isLoggedIn = false,
  role = 'user'
} = {}) {
  const initialized = useRef(false);
  const rolePrefixMap = {
    user: '[USER]',
    restaurant: '[RESTAURANT]',
    delivery: '[DELIVERY PARTNER]',
    admin: '[ADMIN]'
  };

  const ensureRolePrefix = (rawTitle, fallbackRole) => {
    const title = String(rawTitle || 'Zapoo').trim();
    if (title.startsWith('[')) return title;
    const prefix = rolePrefixMap[fallbackRole] || '[NOTIFICATION]';
    return `${prefix} ${title}`;
  };
  useEffect(() => {
    if (!isLoggedIn) {
      // Reset initialization when user logs out so they can re-register on next login
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      // Add a small delay for IndexedDB stability (prevents "IDBDatabase is closing" error)
      await new Promise(r => setTimeout(r, 1500));

      try {
        // ── 1. Check browser support ────────────────────────────────
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
          return;
        }

        // ── 2. Request permission ───────────────────────────────────
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('[FCM] Notification permission not granted, skipping token registration.');
          return;
        }

        // ── 3. Get messaging instance ───────────────────────────────
        const messaging = await getFirebaseMessaging();
        if (!messaging) {
          return;
        }

        // ── 4. Register SW and get FCM token ────────────────────────
        let swReg;
        try {
          swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        } catch (swErr) {
          console.warn('[FCM] SW registration failed:', swErr.message);
          return;
        }
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg
        });
        if (!token) {
          console.warn('[FCM] Failed to get FCM token.');
          return;
        }
        console.log('[FCM] Web FCM token obtained:', token);
        // ── 5. Send token to backend (Cache disabled for debugging) ─────────
        // For testing, we send the token on every page load to ensure Backend DB is up to date

        // Save token to backend based on role
        let endpoint = '/notification/tokens/user';
        if (role === 'restaurant') endpoint = '/notification/tokens/restaurant';
        else if (role === 'delivery') endpoint = '/notification/tokens/delivery';
        else if (role === 'admin') endpoint = '/notification/tokens/admin';
        else if (role === 'user') endpoint = '/notification/tokens/user';

        console.log(`[FCM] Registering token on backend. Role="${role}", Endpoint="${endpoint}"...`);
        try {
          // Logged-in sessions should always try to re-register token with backend.
          // This avoids stale session flags causing "token in localStorage but not in DB" mismatch.
          sessionStorage.removeItem(`fcm_last_fail_status_${role}`);

          const res = await apiClient.post(endpoint, {
            token,
            platform: 'web',
            role
          });
          console.log(`[FCM] ${endpoint} SUCCESS:`, res?.data);
          localStorage.setItem(`${TOKEN_CACHE_KEY}_${role}_VAL`, token);
          localStorage.setItem(`${TOKEN_CACHE_KEY}_${role}`, String(Date.now()));
          sessionStorage.removeItem(`fcm_last_fail_status_${role}`);
        } catch (postErr) {
          console.error(`[FCM] Failed to register token at ${endpoint}:`, postErr.response?.data || postErr.message);
          // If 401, it means the user is not authenticated for this module
          if (postErr.response?.status === 401) {
            console.warn(`[FCM] Authentication failed for role "${role}". Please log in again or wait for approval.`);
            sessionStorage.setItem(`fcm_last_fail_status_${role}`, '401');
          }
        }

        // ── 6. Foreground message handler ────────────────────────────
        // When app tab is focused, show browser notification for foreground FCM.
        onMessage(messaging, payload => {
          const data = payload?.data || {};
          const type = String(data?.type || '').toLowerCase();
          const targetRole = data?.target || role;

          if (role === 'delivery' && ['new_order', 'new_order_available'].includes(type)) {
            const notificationId = data.notificationId;
            if (notificationId) {
              const seenKey = `fcm_seen_${role}_${notificationId}`;
              if (sessionStorage.getItem(seenKey)) {
                return;
              }
              sessionStorage.setItem(seenKey, '1');
            }

            window.dispatchEvent(new CustomEvent('delivery-fcm-order', {
              detail: {
                ...data,
                type,
                notification: payload?.notification || null,
              },
            }));
            return;
          }

          const notificationId = data.notificationId;
          if (notificationId) {
            const seenKey = `fcm_seen_${role}_${notificationId}`;
            if (sessionStorage.getItem(seenKey)) {
              return;
            }
            sessionStorage.setItem(seenKey, '1');
          }
          const rawTitle = payload?.notification?.title || data?.title || 'Zapoo';
          const title = ensureRolePrefix(rawTitle, targetRole);
          const body = payload?.notification?.body || data?.body || '';
          const image = payload?.notification?.image || data?.imageUrl;

          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return;
          }

          try {
            new Notification(title, {
              body,
              icon: '/zapoo-icon.png',
              actions: [],
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
  }, [isLoggedIn, role]);
}
