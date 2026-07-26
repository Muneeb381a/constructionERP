import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import ur from "../locales/ur.json";

const STORAGE_KEY = "construction-erp-lang";
const RTL_LANGS = ["ur"];

export function applyDocumentDirection(lang: string) {
  document.documentElement.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

const storedLang = localStorage.getItem(STORAGE_KEY) ?? "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: storedLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lang) => {
  localStorage.setItem(STORAGE_KEY, lang);
  applyDocumentDirection(lang);
});

applyDocumentDirection(storedLang);

export default i18n;
