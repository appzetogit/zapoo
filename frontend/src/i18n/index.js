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

const activeLanguage = getInitialLanguage();
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: activeLanguage,
      fallbackLng: 'en',
      supportedLngs: ['en', 'hi', 'bn'],
      interpolation: {
        escapeValue: false
      }
    });
}

const resourcesForActive = resources[activeLanguage];
const hasRestaurantDetails = Boolean(resourcesForActive?.translation?.user?.restaurantDetails);
console.log('[i18n-debug] i18n/index.js initialized');
console.log('[i18n-debug] activeLanguage:', activeLanguage);
console.log('[i18n-debug] activeLanguage json:', JSON.stringify(activeLanguage));
console.log('[i18n-debug] resources languages:', Object.keys(resources).join(', '));
console.log('[i18n-debug] resources keys json:', JSON.stringify(Object.keys(resources)));
console.log('[i18n-debug] resources[activeLanguage] === resources.en:', resourcesForActive === resources.en);
console.log('[i18n-debug] resourcesForActive exists:', Boolean(resourcesForActive));
console.log('[i18n-debug] resourcesForActive type:', typeof resourcesForActive);
console.log('[i18n-debug] resourcesForActive keys:', Object.keys(resourcesForActive || {}).join(', '));
console.log('[i18n-debug] translation keys:', Object.keys(resourcesForActive?.translation || {}).join(', '));
console.log('[i18n-debug] user keys:', Object.keys(resourcesForActive?.translation?.user || {}).join(', '));
console.log('[i18n-debug] restaurantDetails value:', resourcesForActive?.translation?.user?.restaurantDetails);
console.log('[i18n-debug] user.restaurantDetails exists for active language:', hasRestaurantDetails);
if (!hasRestaurantDetails) {
  console.error(`[i18n-debug] Missing translation namespace user.restaurantDetails for language ${activeLanguage}`);
}

export default i18n;
