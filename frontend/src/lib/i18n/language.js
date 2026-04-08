import i18n from '@/i18n';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'bn'];
export const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'app_language';

export function normalizeLanguage(language) {
  if (!language || typeof language !== 'string') {
    return DEFAULT_LANGUAGE;
  }

  const normalized = language.toLowerCase().trim();
  if (SUPPORTED_LANGUAGES.includes(normalized)) {
    return normalized;
  }
  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('bn')) return 'bn';
  return 'en';
}

export function getStoredLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
}

export function persistLanguage(language) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, normalizeLanguage(language));
}

export async function setAppLanguage(language) {
  const normalized = normalizeLanguage(language);
  persistLanguage(normalized);
  if (i18n.language !== normalized) {
    await i18n.changeLanguage(normalized);
  }
  document.documentElement.lang = normalized;
  return normalized;
}

export function getCurrentLanguage() {
  return normalizeLanguage(i18n.language || getStoredLanguage());
}

export function getModuleFromPath(pathname) {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/restaurant')) return 'restaurant';
  if (pathname.startsWith('/delivery')) return 'delivery';
  return 'user';
}
