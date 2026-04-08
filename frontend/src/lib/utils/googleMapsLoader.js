import { Loader } from "@googlemaps/js-api-loader";
import { getCurrentLanguage } from "@/lib/i18n/language.js";

const LIBRARIES = ["places", "geocoding"];

let inflightPromise = null;
let inflightKey = null;

/**
 * Single shared load for Maps JS + places + geocoding libraries.
 * Deduplicates parallel Loader.load() calls (e.g. overlay open + map init racing).
 */
export function ensureGoogleMapsLoaded(apiKey, language = getCurrentLanguage()) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }
  if (!apiKey || typeof apiKey !== "string") {
    return Promise.reject(new Error("Google Maps API key is required"));
  }
  const loaderKey = `${apiKey}:${language}`;
  if (inflightPromise && inflightKey === loaderKey) {
    return inflightPromise;
  }
  inflightKey = loaderKey;
  inflightPromise = (async () => {
    try {
      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: LIBRARIES,
        language
      });
      await loader.load();
      return window.google;
    } catch (err) {
      inflightPromise = null;
      inflightKey = null;
      throw err;
    }
  })();
  return inflightPromise;
}
