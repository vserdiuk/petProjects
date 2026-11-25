// UI strings: elements with data-i18n get their text from here.

export const DICTS = {
  en: {
    needCam: 'Camera access is needed to take photos',
    start: 'TURN ON CAMERA', retry: 'TRY AGAIN',
    bright: 'BRIGHT', contrast: 'CONTRAST', pixel: 'PIXEL',
    snapAria: 'Take photo', flipAria: 'Switch camera',
    noSupport: 'This browser has no camera support, or the page is not served over HTTPS.',
    denied: 'Camera access was denied. Allow it in site settings and reload the page.',
    failed: 'Could not open the camera.',
    saved: 'Saved ✓', cancelled: 'Cancelled', downloaded: 'Downloaded ✓',
  },
  uk: {
    needCam: 'Щоб знімати, потрібен доступ до камери',
    start: 'УВІМКНУТИ КАМЕРУ', retry: 'СПРОБУВАТИ ЩЕ',
    bright: 'ЯСКР.', contrast: 'КОНТР.', pixel: 'ПІКСЕЛЬ',
    snapAria: 'Зробити фото', flipAria: 'Змінити камеру',
    noSupport: 'Браузер не підтримує камеру або сторінка відкрита не по HTTPS.',
    denied: 'Доступ до камери заборонено. Дозвольте його в налаштуваннях сайту й оновіть сторінку.',
    failed: 'Не вдалося відкрити камеру.',
    saved: 'Збережено ✓', cancelled: 'Скасовано', downloaded: 'Завантажено ✓',
  },
};

export const LANGS = Object.keys(DICTS);
export const DEFAULT_LANG = 'en';

// Ukrainian for Ukrainian browsers, English for everyone else.
export const detectLang = (navLang = '') => (navLang.toLowerCase().startsWith('uk') ? 'uk' : DEFAULT_LANG);
