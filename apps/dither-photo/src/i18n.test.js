import { describe, expect, it } from 'vitest';
import { DICTS, DEFAULT_LANG, detectLang } from './i18n.js';

describe('dictionaries', () => {
  it('every language has the same keys', () => {
    for (const d of Object.values(DICTS)) expect(Object.keys(d).sort()).toEqual(Object.keys(DICTS.en).sort());
  });
  it('defaults to English', () => expect(DEFAULT_LANG).toBe('en'));
  it('detects Ukrainian browsers', () => {
    expect(detectLang('uk-UA')).toBe('uk');
    expect(detectLang('pl-PL')).toBe('en');
    expect(detectLang()).toBe('en');
  });
});
