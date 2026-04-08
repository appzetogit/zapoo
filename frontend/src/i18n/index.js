import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources.js';

const getInitialLanguage = () => {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const stored = localStorage.getItem('app_language');
  if (!stored) return 'en';
  if (stored.startsWith('hi')) return 'hi';
  if (stored.startsWith('bn')) return 'bn';
  return 'en';
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: getInitialLanguage(),
      fallbackLng: 'en',
      supportedLngs: ['en', 'hi', 'bn'],
      interpolation: {
        escapeValue: false
      }
    });
}

export default i18n;
