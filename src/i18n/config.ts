import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
import ky from './locales/ky.json';

const resources = {
  ru: { translation: ru },
  en: { translation: en },
  ky: { translation: ky }
};

// Определяем язык по умолчанию из localStorage или браузера
const savedLanguage = localStorage.getItem('language');
const defaultLanguage = savedLanguage || 'ru';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: defaultLanguage,
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false
    }
  });

// Сохраняем язык при изменении
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
  document.documentElement.lang = lng;
});

export default i18n;
