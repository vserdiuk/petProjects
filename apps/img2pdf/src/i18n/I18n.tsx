import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DICTS, isLang, type Dict, type Lang } from "./dict";

const KEY = "img2pdf.lang";

function loadLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

type Ctx = { lang: Lang; chosen: boolean; t: Dict; setLang: (l: Lang) => void };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Lang | null>(loadLang);
  const lang = saved ?? "uk";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = DICTS[lang].title;
  }, [lang]);

  const setLang = (l: Lang) => {
    setSaved(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* private mode etc. — the choice just won't be remembered */
    }
  };

  return <I18nContext.Provider value={{ lang, chosen: saved !== null, t: DICTS[lang], setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
