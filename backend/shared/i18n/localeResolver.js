import { DEFAULT_LOCALE, normalizeLocale } from './localeConstants.js';

export function resolveLocaleFromRequest(req) {
  const candidates = [
    req?.headers?.['x-locale'],
    req?.headers?.['accept-language'],
    req?.query?.locale,
    req?.query?.lang,
    req?.body?.locale,
    req?.user?.preferences?.language,
    req?.restaurant?.preferences?.language,
    req?.delivery?.preferences?.language,
    req?.admin?.preferences?.language
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    return normalizeLocale(String(candidate).split(',')[0]);
  }

  return DEFAULT_LOCALE;
}
