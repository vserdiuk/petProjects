import { DICTS, LANGS, guessLang } from "../i18n/dict";
import { useI18n } from "../i18n/I18n";

/** Shown on the first visit, until a language is chosen. */
export function LanguageDialog() {
  const { setLang } = useI18n();
  const suggested = guessLang(typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]);
  return (
    <div className="lang-backdrop">
      <div className="lang-dialog" role="dialog" aria-modal="true" aria-labelledby="lang-title">
        <div className="lang-icon" aria-hidden>📚</div>
        <h2 id="lang-title">
          {LANGS.map((l) => DICTS[l.code].chooseLang).join(" · ")}
        </h2>
        <div className="lang-options">
          {LANGS.map((l) => (
            <button key={l.code} autoFocus={l.code === suggested} className={l.code === suggested ? "suggested" : ""} onClick={() => setLang(l.code)}>
              <span className="flag" aria-hidden>{l.flag}</span>
              {l.name}
            </button>
          ))}
        </div>
        <p className="hint">{DICTS[suggested].chooseLangHint}</p>
      </div>
    </div>
  );
}

/** Compact switcher for the header. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t.langLabel}>
      {LANGS.map((l) => (
        <button key={l.code} aria-pressed={lang === l.code} className={lang === l.code ? "on" : ""} title={l.name} onClick={() => setLang(l.code)}>
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
