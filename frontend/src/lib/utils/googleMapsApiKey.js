/**
 * Google Maps API Key Utility
 *
 * Fetches the API key from Firebase Realtime Database (REST, no SDK needed)
 * instead of hitting the backend admin API.
 *
 * Cost benefit:
 *  - 1 Firebase REST GET per page session (≈ 0 cost on free tier)
 *  - Cached in module memory — zero subsequent calls
 *  - Key updateable in Firebase Console without redeployment
 *
 * Firebase RTDB path: /config/googleMapsApiKey
 * Required RTDB rule: { "rules": { "config": { ".read": true } } }
 */

const FIREBASE_RTDB_URL =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  'https://zapoo-d23ea-default-rtdb.asia-southeast1.firebasedatabase.app';

let cachedApiKey = null;
let apiKeyPromise = null;

/**
 * Get Google Maps API Key from Firebase RTDB (REST endpoint).
 * Uses module-level caching — only one network request per page session.
 * @returns {Promise<string>} Google Maps API Key or empty string on failure
 */
export async function getGoogleMapsApiKey() {
  // Return cached key if available
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // Return existing promise if already fetching (prevents duplicate in-flight requests)
  if (apiKeyPromise) {
    return apiKeyPromise;
  }

  apiKeyPromise = (async () => {
    try {
      const url = `${FIREBASE_RTDB_URL}/config/googleMapsApiKey.json`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`⚠️ Firebase RTDB: Failed to fetch Maps API key (HTTP ${response.status})`);
        return '';
      }

      const data = await response.json();

      if (data && typeof data === 'string' && data.length > 0) {
        cachedApiKey = data;
        return cachedApiKey;
      }

      console.warn(
        '⚠️ Google Maps API key not found in Firebase RTDB.\n' +
        '   Set it at: Firebase Console → Realtime Database → /config/googleMapsApiKey'
      );
      return '';
    } catch (error) {
      console.warn('⚠️ Failed to fetch Google Maps API key from Firebase RTDB:', error.message);
      return '';
    } finally {
      apiKeyPromise = null;
    }
  })();

  return apiKeyPromise;
}

/**
 * Clear cached API key.
 * Call this after updating the key in Firebase so the next load picks up the new value.
 */
export function clearGoogleMapsApiKeyCache() {
  cachedApiKey = null;
  apiKeyPromise = null;
}
