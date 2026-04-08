import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { adminAPI, deliveryAPI, restaurantAPI, userAPI } from "@/lib/api";
import { getModuleFromPath, getStoredLanguage, setAppLanguage } from "@/lib/i18n/language";
import { isModuleAuthenticated } from "@/lib/utils/auth";

async function fetchLanguageForModule(module) {
  if (module === "admin" && isModuleAuthenticated("admin")) {
    return adminAPI.getPreferences();
  }
  if (module === "restaurant" && isModuleAuthenticated("restaurant")) {
    return restaurantAPI.getPreferences();
  }
  if (module === "delivery" && isModuleAuthenticated("delivery")) {
    return deliveryAPI.getPreferences();
  }
  if (module === "user" && isModuleAuthenticated("user")) {
    return userAPI.getPreferences();
  }
  return null;
}

export default function LanguageBootstrap() {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const applyLanguage = async () => {
      await setAppLanguage(getStoredLanguage());

      const module = getModuleFromPath(location.pathname);
      try {
        const response = await fetchLanguageForModule(module);
        const language = response?.data?.data?.preferences?.language;
        if (!cancelled && language) {
          await setAppLanguage(language);
        }
      } catch {
        // Use stored language fallback silently
      }
    };

    applyLanguage();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return null;
}
