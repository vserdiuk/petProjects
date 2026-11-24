import { plural } from "../lib/plural";

export type Lang = "uk" | "en";

export const LANGS: { code: Lang; name: string; flag: string }[] = [
  { code: "uk", name: "Українська", flag: "🇺🇦" },
  { code: "en", name: "English", flag: "🇬🇧" },
];

const enPlural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const uk = {
  title: "Картинки → PDF",
  langLabel: "Мова",
  chooseLang: "Оберіть мову",
  chooseLangHint: "Змінити її можна будь-коли у верхньому правому куті.",

  dropTitle: "Перетягніть картинки сюди",
  dropOr: "або натисніть, щоб вибрати",
  dropHint: "PNG, JPG, WEBP… Нові файли додаються в кінець, відсортовані за назвою.",
  dropping: "Відпустіть, щоб додати картинки",
  close: "Закрити",

  sumFormat: (n: number) => `${n} ${plural(n, ["картинка", "картинки", "картинок"])} не у форматі PNG`,
  convertAll: "Конвертувати всі в PNG",
  sumSize: (n: number) => `${n} ${plural(n, ["картинка має", "картинки мають", "картинок мають"])} інший розмір, ніж`,
  sumSizeChosen: "(вибраний вами)",
  sumSizeMost: "(у більшості)",
  fitAll: "Підігнати всі",
  resetTarget: "Скинути основний розмір",
  sumHeavy: (n: number) => `${n} ${plural(n, ["файл", "файли", "файлів"])} значно ${n === 1 ? "важчий" : "важчі"} за інші`,
  compress: "Стиснути",

  tabImages: "Картинки",
  tabPreview: "Перегляд PDF",
  sortByName: "Сортувати за назвою",
  clear: "Очистити",

  dragHint: "Перетягніть, щоб змінити порядок",
  issueFormat: (label: string) => `Формат ${label}, а не PNG`,
  makePng: "Зробити PNG",
  issueSize: (size: string) => `Розмір відрізняється від ${size}`,
  otherRatio: "(інші пропорції)",
  fit: "Підігнати",
  makeMain: "Зробити основним",
  issueHeavy: (times: number) => `Файл у ${times}× важчий за інші`,
  earlier: "Раніше",
  later: "Пізніше",
  replace: "Замінити",
  remove: "Видалити",

  noteConvert: (from: string) => `${from} → PNG`,
  noteResize: (from: string, to: string) => `${from} → ${to}`,
  noteCompress: (from: string, to: string) => `стиснуто ${from} → ${to}`,

  pageSize: "Розмір сторінок",
  modeUniform: "Однакові сторінки",
  modeUniformHint: (size: string | null) => (size ? `усі ${size} px` : "за найпоширенішим розміром"),
  modeImage: "Як у картинки",
  modeImageHint: "кожна сторінка свого розміру",
  modeA4: "A4",
  modeA4Hint: "для друку",
  fitLabel: "Якщо пропорції не збігаються",
  fitContain: "Вписати повністю (з полями)",
  fitCover: "Заповнити (обрізати краї)",
  fitStretch: "Розтягнути",
  fitHint: "Також використовується кнопкою «Підігнати».",
  margin: "Поля, мм",
  background: "Фон",
  fileName: "Назва файлу",
  stats: (n: number, size: string) => `${n} ${plural(n, ["сторінка", "сторінки", "сторінок"])} · ≈ ${size}`,
  download: "⬇ Завантажити PDF",
  openPdf: "Відкрити PDF у новій вкладці",

  busyRead: "Читаю файли…",
  busyPng: "Конвертую в PNG…",
  busyFit: "Підганяю розмір…",
  busyCompress: "Стискаю…",
  busyPdf: "Створюю PDF…",

  msgSkipped: (names: string) => `Пропущено (не картинки): ${names}`,
  msgDecodeFail: (names: string) => `Браузер не зміг відкрити: ${names}. Збережіть їх як PNG або JPG.`,
  msgProcessFail: (name: string) => `Не вдалося обробити ${name}.`,
  msgCompressFail: (name: string, isJpg: boolean) =>
    `${name}: не вдалося помітно зменшити файл без втрати якості.` +
    (isJpg ? "" : " Спробуйте зменшити розмір картинки (кнопка «Підігнати»)."),
  msgPdfFail: "Не вдалося створити PDF. Спробуйте конвертувати проблемні картинки в PNG.",
  msgDone: (file: string, size: string) => `Готово: ${file} (${size}).`,

  previewEmpty: "Додайте картинки, щоб побачити сторінки PDF.",
  zoom: "Масштаб",
  zoomHint: "(клік по сторінці — збільшити)",
  pageCaption: (i: number, w: number, h: number) => `Сторінка ${i} · ${w}×${h} мм`,
};

export type Dict = typeof uk;

const en: Dict = {
  title: "Images → PDF",
  langLabel: "Language",
  chooseLang: "Choose your language",
  chooseLangHint: "You can change it any time in the top right corner.",

  dropTitle: "Drop pictures here",
  dropOr: "or click to choose",
  dropHint: "PNG, JPG, WEBP… New files are added at the end, sorted by name.",
  dropping: "Release to add the pictures",
  close: "Close",

  sumFormat: (n) => `${n} ${enPlural(n, "picture is", "pictures are")} not PNG`,
  convertAll: "Convert all to PNG",
  sumSize: (n) => `${n} ${enPlural(n, "picture has", "pictures have")} a size other than`,
  sumSizeChosen: "(chosen by you)",
  sumSizeMost: "(most common)",
  fitAll: "Fit all",
  resetTarget: "Reset main size",
  sumHeavy: (n) => `${n} ${enPlural(n, "file is", "files are")} much heavier than the rest`,
  compress: "Compress",

  tabImages: "Pictures",
  tabPreview: "PDF preview",
  sortByName: "Sort by name",
  clear: "Clear",

  dragHint: "Drag to change the order",
  issueFormat: (label) => `${label} format, not PNG`,
  makePng: "Make PNG",
  issueSize: (size) => `Size differs from ${size}`,
  otherRatio: "(different proportions)",
  fit: "Fit",
  makeMain: "Make it the main size",
  issueHeavy: (times) => `File is ${times}× heavier than the rest`,
  earlier: "Earlier",
  later: "Later",
  replace: "Replace",
  remove: "Remove",

  noteConvert: (from) => `${from} → PNG`,
  noteResize: (from, to) => `${from} → ${to}`,
  noteCompress: (from, to) => `compressed ${from} → ${to}`,

  pageSize: "Page size",
  modeUniform: "Same for all pages",
  modeUniformHint: (size) => (size ? `all ${size} px` : "most common picture size"),
  modeImage: "Like each picture",
  modeImageHint: "every page has its own size",
  modeA4: "A4",
  modeA4Hint: "for printing",
  fitLabel: "If proportions differ",
  fitContain: "Fit whole picture (with bands)",
  fitCover: "Fill page (crop edges)",
  fitStretch: "Stretch",
  fitHint: "Also used by the “Fit” button.",
  margin: "Margins, mm",
  background: "Background",
  fileName: "File name",
  stats: (n, size) => `${n} ${enPlural(n, "page", "pages")} · ≈ ${size}`,
  download: "⬇ Download PDF",
  openPdf: "Open PDF in a new tab",

  busyRead: "Reading files…",
  busyPng: "Converting to PNG…",
  busyFit: "Fitting size…",
  busyCompress: "Compressing…",
  busyPdf: "Creating PDF…",

  msgSkipped: (names) => `Skipped (not pictures): ${names}`,
  msgDecodeFail: (names) => `The browser could not open: ${names}. Save them as PNG or JPG.`,
  msgProcessFail: (name) => `Could not process ${name}.`,
  msgCompressFail: (name, isJpg) =>
    `${name}: could not make the file noticeably smaller without losing quality.` +
    (isJpg ? "" : " Try reducing the picture size (the “Fit” button)."),
  msgPdfFail: "Could not create the PDF. Try converting the problem pictures to PNG.",
  msgDone: (file, size) => `Done: ${file} (${size}).`,

  previewEmpty: "Add pictures to see the PDF pages.",
  zoom: "Zoom",
  zoomHint: "(click a page to enlarge)",
  pageCaption: (i, w, h) => `Page ${i} · ${w}×${h} mm`,
};

export const DICTS: Record<Lang, Dict> = { uk, en };

/** Best guess from the browser settings — only used to highlight a choice. */
export function guessLang(languages: readonly string[]): Lang {
  for (const l of languages) {
    const code = l.toLowerCase().slice(0, 2);
    if (code === "uk" || code === "ru" || code === "be") return "uk";
    if (code === "en") return "en";
  }
  return "en";
}

export function isLang(v: unknown): v is Lang {
  return v === "uk" || v === "en";
}
