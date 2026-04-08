import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale } from './localeConstants.js';
import { getEnvVar } from '../utils/envService.js';

const translationCache = new Map();

function cacheKey(sourceText, targetLocale) {
  return `${targetLocale}::${sourceText}`;
}

async function buildGoogleAuth() {
  const projectId =
    await getEnvVar('GOOGLE_CLOUD_PROJECT_ID') ||
    await getEnvVar('GCLOUD_PROJECT_ID') ||
    await getEnvVar('GOOGLE_PROJECT_ID');

  const clientEmail = await getEnvVar('GOOGLE_CLOUD_CLIENT_EMAIL');
  const privateKeyRaw = await getEnvVar('GOOGLE_CLOUD_PRIVATE_KEY');
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : '';

  const hasServiceAccount = projectId && clientEmail && privateKey;
  const authOptions = hasServiceAccount
    ? {
        credentials: {
          client_email: clientEmail,
          private_key: privateKey
        },
        projectId
      }
    : {};

  return {
    auth: new GoogleAuth({
      ...authOptions,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    }),
    projectId
  };
}

export async function isTranslationConfigured() {
  const apiKey = await getEnvVar('GOOGLE_TRANSLATE_API_KEY');
  const projectId =
    await getEnvVar('GOOGLE_CLOUD_PROJECT_ID') ||
    await getEnvVar('GCLOUD_PROJECT_ID') ||
    await getEnvVar('GOOGLE_PROJECT_ID');
  const clientEmail = await getEnvVar('GOOGLE_CLOUD_CLIENT_EMAIL');
  const privateKey = await getEnvVar('GOOGLE_CLOUD_PRIVATE_KEY');

  return Boolean(apiKey || (projectId && clientEmail && privateKey));
}

export async function translateText(sourceText, targetLocale, sourceLocale = DEFAULT_LOCALE) {
  const normalizedTarget = normalizeLocale(targetLocale);
  const normalizedSource = normalizeLocale(sourceLocale);
  const trimmed = typeof sourceText === 'string' ? sourceText.trim() : '';

  if (!trimmed) return '';
  if (!SUPPORTED_LOCALES.includes(normalizedTarget) || normalizedTarget === normalizedSource) {
    return trimmed;
  }

  const key = cacheKey(trimmed, normalizedTarget);
  if (translationCache.has(key)) {
    return translationCache.get(key);
  }

  const apiKey = await getEnvVar('GOOGLE_TRANSLATE_API_KEY');
  let translated = trimmed;

  if (apiKey) {
    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        q: trimmed,
        target: normalizedTarget,
        source: normalizedSource,
        format: 'text'
      },
      { timeout: 10000 }
    );
    translated = response?.data?.data?.translations?.[0]?.translatedText || trimmed;
  } else {
    const { auth, projectId } = await buildGoogleAuth();
    if (!projectId) {
      return trimmed;
    }
    const client = await auth.getClient();
    const accessTokenResponse = await client.getAccessToken();
    const accessToken =
      typeof accessTokenResponse === 'string'
        ? accessTokenResponse
        : accessTokenResponse?.token;

    if (!accessToken) {
      return trimmed;
    }

    const response = await axios.post(
      `https://translation.googleapis.com/v3/projects/${projectId}:translateText`,
      {
        contents: [trimmed],
        mimeType: 'text/plain',
        sourceLanguageCode: normalizedSource,
        targetLanguageCode: normalizedTarget
      },
      {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    translated = response?.data?.translations?.[0]?.translatedText || trimmed;
  }

  translationCache.set(key, translated);
  return translated;
}

export async function buildLocalizedText(sourceText, locales = SUPPORTED_LOCALES) {
  const baseText = typeof sourceText === 'string' ? sourceText.trim() : '';
  const localized = {
    en: baseText,
    hi: '',
    bn: ''
  };

  if (!baseText) {
    return localized;
  }

  await Promise.all(
    locales.map(async (locale) => {
      const normalized = normalizeLocale(locale);
      if (normalized === 'en') return;
      try {
        localized[normalized] = await translateText(baseText, normalized, 'en');
      } catch (error) {
        console.warn(`[i18n] Failed to translate text to ${normalized}: ${error.message}`);
      }
    })
  );

  return localized;
}
