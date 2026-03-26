/**
 * Business Settings Utility
 * Handles loading and updating business settings (title, logo)
 */

import apiClient from "../api/axios.js";
import { API_ENDPOINTS } from "../api/config.js";
import { getCachedResource, invalidateCachedResource } from "../api/requestCache.js";

let cachedSettings = null;

/**
 * Load business settings from backend (public endpoint - no auth required)
 */
export const loadBusinessSettings = async (options = {}) => {
  try {
    const {
      ttl = 5 * 60 * 1000,
      force = false,
    } = options;

    if (cachedSettings && !force) {
      return cachedSettings;
    }

    const response = await getCachedResource(
      "business-settings:public",
      () => apiClient.get(API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS_PUBLIC),
      { ttl, force }
    );
    const settings = response?.data?.data || response?.data;

    if (settings) {
      cachedSettings = settings;
      updateTitle(settings.companyName);
      return settings;
    }
  } catch (error) {
    // Silently fail - this is expected if settings don't exist yet
    return null;
  }
};



/**
 * Update page title
 */
export const updateTitle = (companyName) => {
  if (companyName) {
    document.title = companyName;
  }
};

/**
 * Clear cached settings (call after updating settings)
 */
export const clearCache = () => {
  cachedSettings = null;
  invalidateCachedResource("business-settings:public");
};

/**
 * Get cached settings
 */
export const getCachedSettings = () => {
  return cachedSettings;
};

/**
 * Get company name from business settings with fallback
 * @returns {string} Company name or default "Appzeto Food"
 */
export const getCompanyName = () => {
  const settings = getCachedSettings();
  return settings?.companyName || "Appzeto Food";
};

/**
 * Get company name asynchronously (loads if not cached)
 * @returns {Promise<string>} Company name or default "Appzeto Food"
 */
export const getCompanyNameAsync = async () => {
  try {
    const settings = await loadBusinessSettings();
    return settings?.companyName || "Appzeto Food";
  } catch (error) {
    return "Appzeto Food";
  }
};
