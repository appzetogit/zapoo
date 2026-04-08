export const SUPPORTED_LOCALES = ['en', 'hi', 'bn'];
export const DEFAULT_LOCALE = 'en';

export function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') {
    return DEFAULT_LOCALE;
  }

  const normalized = locale.toLowerCase().trim();

  if (SUPPORTED_LOCALES.includes(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('bn')) return 'bn';
  if (normalized.startsWith('en')) return 'en';

  return DEFAULT_LOCALE;
}

export function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(normalizeLocale(locale));
}
