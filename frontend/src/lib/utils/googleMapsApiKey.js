import { API_BASE_URL } from "@/lib/api/config.js"

/**
 * Google Maps API Key Utility
 *
 * Source of truth: Admin ENV Setup (MongoDB) via backend public endpoint.
 * - GET `${API_BASE_URL}/env/public`
 * - returns: { data: { VITE_GOOGLE_MAPS_API_KEY: string } }
 *
 * Notes:
 * - Firebase RTDB and frontend env fallbacks are intentionally removed.
 * - Module-level caching prevents repeated network calls per page/session.
 */

let cachedApiKey = null;
let apiKeyPromise = null;
let missingKeyWarned = false;

/**
 * Get Google Maps API Key from backend admin ENV (MongoDB) public endpoint.
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
      const url = `${API_BASE_URL}/env/public`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`⚠️ Env public: Failed to fetch Maps API key (HTTP ${response.status})`);
        return '';
      }

      const json = await response.json();
      const key = json?.data?.VITE_GOOGLE_MAPS_API_KEY;

      if (typeof key === "string" && key.length > 0) {
        cachedApiKey = key;
        return cachedApiKey;
      }

      if (!missingKeyWarned) {
        console.warn(
          '⚠️ Google Maps API key not found in Admin ENV Setup (MongoDB).\n' +
          '   Admin → System → ENV Setup → set "Google Maps API Key".'
        );
        missingKeyWarned = true;
      }
      return '';
    } catch (error) {
      if (!missingKeyWarned) {
        console.warn('⚠️ Failed to fetch Google Maps API key from Admin ENV public endpoint:', error.message);
        missingKeyWarned = true;
      }
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
  missingKeyWarned = false;
}
