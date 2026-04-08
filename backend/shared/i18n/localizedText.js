import mongoose from 'mongoose';
import { DEFAULT_LOCALE, normalizeLocale } from './localeConstants.js';

export const localizedTextSchema = new mongoose.Schema({
  en: {
    type: String,
    trim: true,
    default: ''
  },
  hi: {
    type: String,
    trim: true,
    default: ''
  },
  bn: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: false });

export function toLocalizedText(value, fallback = '') {
  if (!value) {
    return {
      en: fallback || '',
      hi: '',
      bn: ''
    };
  }

  if (typeof value === 'string') {
    return {
      en: value,
      hi: '',
      bn: ''
    };
  }

  return {
    en: value.en || fallback || '',
    hi: value.hi || '',
    bn: value.bn || ''
  };
}

export function resolveLocalizedText(value, locale = DEFAULT_LOCALE, fallback = '') {
  if (!value) {
    return fallback || '';
  }

  if (typeof value === 'string') {
    return value;
  }

  const normalizedLocale = normalizeLocale(locale);
  return value[normalizedLocale] || value.en || fallback || '';
}
