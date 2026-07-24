import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import it from './it.json';
import es from './es.json';
import zh from './zh.json';
import fr from './fr.json';
import de from './de.json';
import ja from './ja.json';
import ru from './ru.json';
import ko from './ko.json';
import tl from './tl.json';
import { SUPPORTED_LANGUAGES } from '../features/settings';
export type { AppLanguage } from '../features/settings';

const translations = { en, it, es, zh, fr, de, ja, ru, ko, tl };
const resources = {
  ...Object.fromEntries(
    SUPPORTED_LANGUAGES.map(({ id }) => [id, { translation: translations[id] }]),
  ),
  // Browser auto-detection often reports fil / fil-PH
  fil: { translation: tl },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: {
      fil: ['tl', 'en'],
      default: ['en'],
    },
    supportedLngs: [...SUPPORTED_LANGUAGES.map((l) => l.id), 'fil'],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage', 'cookie'],
    },
  });
