import { deleteToken } from "firebase/messaging";
import { notificationAPI } from "@/lib/api";
import { getFirebaseMessaging } from "@/lib/firebaseConfig";

/**
 * Revoke current browser FCM token on logout so next login registers a fresh token.
 * This is best-effort: failures are logged but do not block logout.
 */
export async function revokeFcmTokenOnLogout(role = "user") {
  const tokenValueKey = `fcm_token_registered_${role}_VAL`;
  const tokenTimeKey = `fcm_token_registered_${role}`;
  const savedToken = localStorage.getItem(tokenValueKey);

  try {
    if (savedToken) {
      await notificationAPI.removeToken(savedToken);
    }
  } catch (err) {
    console.warn(`[FCM] Backend token removal failed for role "${role}":`, err?.response?.data || err?.message);
  }

  try {
    const messaging = await getFirebaseMessaging();
    if (messaging) {
      await deleteToken(messaging);
    }
  } catch (err) {
    console.warn(`[FCM] Client token revoke failed for role "${role}":`, err?.message || err);
  }

  localStorage.removeItem(tokenValueKey);
  localStorage.removeItem(tokenTimeKey);
  sessionStorage.removeItem(`fcm_last_fail_status_${role}`);
}

