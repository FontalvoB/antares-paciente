import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import es from "./es.json";
import en from "./en.json";

type Language = "es" | "en";

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (source: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "antares_lang";
const dictionaries: Record<Language, Record<string, string>> = { es, en };
const warnedKeys = new Set<string>();
const isDev = import.meta.env.DEV || __DEV_TOOLS__;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "es" || stored === "en") return stored;
    }
    return "es";
  });

  const t = useCallback(
    (source: string, params?: Record<string, string>): string => {
      const found = dictionaries[lang][source];
      let translated = found && found.length > 0 ? found : source;
      if (!found && lang !== "es" && isDev && !warnedKeys.has(source)) {
        warnedKeys.add(source);
        console.warn(`[i18n] Missing key for "${lang}":`, source);
      }
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          translated = translated.replace(
            new RegExp(`\\{${key}\\}`, "g"),
            value,
          );
        });
      }
      return translated;
    },
    [lang],
  );

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === "es" ? "en" : "es";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  const { t } = useI18n();
  return t;
}
