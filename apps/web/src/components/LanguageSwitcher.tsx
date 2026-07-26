import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "en", label: "English", short: "EN" },
  { code: "ur", label: "اردو", short: "اردو" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const activeIndex = Math.max(
    0,
    LANGS.findIndex((l) => l.code === i18n.language),
  );

  return (
    <div className="flex items-center gap-2 px-1">
      <Globe size={14} className="shrink-0 text-gray-500" aria-hidden="true" />
      <div className="relative flex flex-1 rounded-full bg-white/5 p-0.5 ring-1 ring-white/10">
        <div
          aria-hidden="true"
          className="absolute inset-y-0.5 rounded-full bg-blue-600 shadow-sm transition-transform duration-200 ease-out"
          style={{ width: `calc(${100 / LANGS.length}% - 2px)`, transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 2}px))` }}
        />
        {LANGS.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => i18n.changeLanguage(lang.code)}
            aria-pressed={i18n.language === lang.code}
            title={lang.label}
            className={`relative z-10 flex-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
              i18n.language === lang.code ? "text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {lang.short}
          </button>
        ))}
      </div>
    </div>
  );
}
