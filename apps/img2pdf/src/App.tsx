import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageCard } from "./components/ImageCard";
import { LanguageDialog, LanguageSwitch } from "./components/Language";
import { Preview } from "./components/Preview";
import type { Dict } from "./i18n/dict";
import { useI18n } from "./i18n/I18n";
import { dominantSize, findIssues, formatBytes, formatLabel, moveItem, naturalCompare, sizeKey, type Issue } from "./lib/analyze";
import { readImage, render, withExt } from "./lib/image";
import type { PdfImage, PdfProgress } from "./lib/pdf";
import { buildPdfInWorker } from "./lib/pdfClient";
import { DEFAULT_SETTINGS, type ImageItem, type Note, type PageMode, type Settings, type Size } from "./lib/types";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name);

/** Messages are kept as functions so they follow a language switch. */
type Message = (t: Dict) => string;
type BusyKey = "busyRead" | "busyPng" | "busyFit" | "busyCompress" | "busyPdf";

export function App() {
  const { t, chosen } = useI18n();
  const [items, setItems] = useState<ImageItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [targetOverride, setTargetOverride] = useState<Size | null>(null);
  const [tab, setTab] = useState<"list" | "preview">("list");
  const [busy, setBusy] = useState<BusyKey | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dragFiles, setDragFiles] = useState(false);
  const [viewing, setViewing] = useState<ImageItem | null>(null);
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);
  const pdfAbort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Free object URLs when the page is closed.
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const dominant = useMemo(() => dominantSize(items), [items]);
  const target = targetOverride ?? dominant;
  const issues = useMemo(() => findIssues(items, target), [items, target]);
  const counts = useMemo(() => {
    const c = { format: 0, size: 0, heavy: 0 };
    for (const list of issues.values()) for (const i of list) c[i.kind]++;
    return c;
  }, [issues]);
  const totalBytes = items.reduce((s, i) => s + i.size, 0);

  const say = (msg: Message) => setMessages((m) => [...m, msg]);

  // ---------- adding / replacing ----------
  const addFiles = useCallback(async (list: FileList | File[]) => {
    const files = [...list];
    const skipped = files.filter((f) => !isImage(f));
    const images = files.filter(isImage).sort((a, b) => naturalCompare(a.name, b.name));
    if (skipped.length) {
      const names = skipped.map((f) => f.name).join(", ");
      say((t) => t.msgSkipped(names));
    }
    if (!images.length) return;
    setBusy("busyRead");
    const results = await Promise.allSettled(images.map((f) => readImage(f, f.name)));
    const ok: ImageItem[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(r.value) : failed.push(images[i].name)));
    if (failed.length) {
      const names = failed.join(", ");
      say((t) => t.msgDecodeFail(names));
    }
    setItems((prev) => [...prev, ...ok]);
    setBusy(null);
  }, []);

  /** Swap an item for a new one in the same position. */
  const swap = (oldItem: ImageItem, next: ImageItem) => {
    setItems((prev) => prev.map((i) => (i.id === oldItem.id ? next : i)));
    URL.revokeObjectURL(oldItem.url);
  };

  const replaceWithFile = async (item: ImageItem, file: File) => {
    try {
      swap(item, await readImage(file, file.name));
    } catch {
      say((t) => t.msgDecodeFail(file.name));
    }
  };

  const remove = (item: ImageItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    URL.revokeObjectURL(item.url);
  };

  const clearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setTargetOverride(null);
    setMessages([]);
  };

  // ---------- fixes ----------
  const toPng = async (item: ImageItem) => {
    const blob = await render(item, { mime: "image/png" });
    return readImage(blob, withExt(item.name, "png"), [...item.notes, { kind: "convert", from: formatLabel(item.mime) }]);
  };

  const toSize = async (item: ImageItem, size: Size) => {
    const blob = await render(item, { mime: "image/png", size, fit: settings.fit, background: settings.background });
    const notes: Note[] = [...item.notes, { kind: "resize", from: sizeKey(item), to: sizeKey(size) }];
    if (item.mime !== "image/png") notes.push({ kind: "convert", from: formatLabel(item.mime) });
    return readImage(blob, withExt(item.name, "png"), notes);
  };

  const optimize = async (item: ImageItem) => {
    const jpg = item.mime === "image/jpeg";
    const blob = await render(item, { mime: jpg ? "image/jpeg" : "image/png", quality: 0.9, background: settings.background });
    if (blob.size >= item.size * 0.95) {
      say((t) => t.msgCompressFail(item.name, jpg));
      return null;
    }
    return readImage(blob, item.name, [...item.notes, { kind: "compress", from: item.size, to: blob.size }]);
  };

  const run = async (label: BusyKey, list: ImageItem[], fn: (i: ImageItem) => Promise<ImageItem | null>) => {
    setBusy(label);
    for (const item of list) {
      try {
        const next = await fn(item);
        if (next) swap(item, next);
      } catch {
        say((t) => t.msgProcessFail(item.name));
      }
    }
    setBusy(null);
  };

  const withIssue = (kind: Issue["kind"]) => items.filter((i) => issues.get(i.id)?.some((x) => x.kind === kind));

  // ---------- reorder ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((prev) => moveItem(prev, prev.findIndex((i) => i.id === active.id), prev.findIndex((i) => i.id === over.id)));
  };
  const sortByName = () => setItems((prev) => [...prev].sort((a, b) => naturalCompare(a.name, b.name)));

  // ---------- PDF ----------
  const makePdf = async (): Promise<Blob | null> => {
    setBusy("busyPdf");
    setPdfProgress(null);
    const abort = new AbortController();
    pdfAbort.current = abort;
    try {
      const images: PdfImage[] = [];
      for (const it of items) {
        // pdf-lib can embed only PNG and JPG; anything else is converted on the fly.
        const ready = it.mime === "image/png" || it.mime === "image/jpeg";
        const blob = ready ? it.blob : await render(it, { mime: "image/png" });
        if (abort.signal.aborted) throw new DOMException("cancelled", "AbortError");
        images.push({
          width: it.width,
          height: it.height,
          mime: ready ? (it.mime as PdfImage["mime"]) : "image/png",
          bytes: await blob.arrayBuffer(),
        });
      }
      // Heavy work (PNG decoding/compression in pdf-lib) runs in a Web Worker.
      const bytes = await buildPdfInWorker(images, settings, target, setPdfProgress, abort.signal);
      return new Blob([bytes as BlobPart], { type: "application/pdf" });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") say((t) => t.msgCancelled);
      else {
        console.error(e);
        say((t) => t.msgPdfFail);
      }
      return null;
    } finally {
      pdfAbort.current = null;
      setPdfProgress(null);
      setBusy(null);
    }
  };
  const cancelPdf = () => pdfAbort.current?.abort();
  // Stop a running build if the app is closed.
  useEffect(() => () => pdfAbort.current?.abort(), []);

  const fileName = withExt((settings.fileName.trim() || "images").replace(/\.pdf$/i, "") + ".x", "pdf");

  const download = async () => {
    const blob = await makePdf();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    const size = formatBytes(blob.size);
    say((t) => t.msgDone(fileName, size));
  };

  const openPdf = async () => {
    const tabRef = window.open("", "_blank"); // open synchronously so popup blockers allow it
    const blob = await makePdf();
    if (!blob) return tabRef?.close();
    const url = URL.createObjectURL(blob);
    if (tabRef) tabRef.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // ---------- drag files onto the page ----------
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragFiles(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      if (--depth <= 0) (depth = 0), setDragFiles(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragFiles(false);
      if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [addFiles]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const modes: { value: PageMode; label: string; hint: string }[] = [
    { value: "uniform", label: t.modeUniform, hint: t.modeUniformHint(target ? sizeKey(target) : null) },
    { value: "image", label: t.modeImage, hint: t.modeImageHint },
    { value: "a4", label: t.modeA4, hint: t.modeA4Hint },
  ];

  return (
    <div className="app">
      <header className="top">
        <a className="back" href="../">← Pet projects</a>
        <h1>{t.title}</h1>
        <span className="spacer" />
        <LanguageSwitch />
      </header>

      <div className="layout">
        <main className="main">
          <section className="drop" onClick={() => inputRef.current?.click()}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <strong>{t.dropTitle}</strong> {t.dropOr}
            <span className="hint">{t.dropHint}</span>
          </section>

          {messages.length > 0 && (
            <div className="messages">
              {messages.map((m, i) => (
                <p key={i}>{m(t)}</p>
              ))}
              <button className="link" onClick={() => setMessages([])}>{t.close}</button>
            </div>
          )}

          {items.length > 0 && (
            <>
              {(counts.format > 0 || counts.size > 0 || counts.heavy > 0) && (
                <div className="summary">
                  {counts.format > 0 && (
                    <p>
                      <span>⚠ {t.sumFormat(counts.format)}</span>
                      <button disabled={!!busy} onClick={() => run("busyPng", withIssue("format"), toPng)}>
                        {t.convertAll}
                      </button>
                    </p>
                  )}
                  {counts.size > 0 && target && (
                    <p>
                      <span>
                        ⚠ {t.sumSize(counts.size)} <b>{sizeKey(target)}</b> {targetOverride ? t.sumSizeChosen : t.sumSizeMost}
                      </span>
                      <button disabled={!!busy} onClick={() => run("busyFit", withIssue("size"), (i) => toSize(i, target))}>
                        {t.fitAll}
                      </button>
                      {targetOverride && (
                        <button className="link" onClick={() => setTargetOverride(null)}>{t.resetTarget}</button>
                      )}
                    </p>
                  )}
                  {counts.heavy > 0 && (
                    <p>
                      <span>⚠ {t.sumHeavy(counts.heavy)}</span>
                      <button disabled={!!busy} onClick={() => run("busyCompress", withIssue("heavy"), optimize)}>{t.compress}</button>
                    </p>
                  )}
                </div>
              )}

              <div className="bar">
                <div className="tabs" role="tablist">
                  <button role="tab" aria-selected={tab === "list"} className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>
                    {t.tabImages} · {items.length}
                  </button>
                  <button role="tab" aria-selected={tab === "preview"} className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>
                    {t.tabPreview}
                  </button>
                </div>
                <span className="spacer" />
                {tab === "list" && (
                  <>
                    <button onClick={sortByName}>{t.sortByName}</button>
                    <button className="danger" onClick={clearAll}>{t.clear}</button>
                  </>
                )}
              </div>

              {tab === "list" ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
                    <ol className="cards">
                      {items.map((it, i) => (
                        <ImageCard
                          key={it.id}
                          item={it}
                          index={i}
                          total={items.length}
                          issues={issues.get(it.id) ?? []}
                          busy={!!busy}
                          onMove={(to) => setItems((prev) => moveItem(prev, i, to))}
                          onRemove={() => remove(it)}
                          onReplace={(f) => replaceWithFile(it, f)}
                          onConvert={() => run("busyPng", [it], toPng)}
                          onFit={() => target && run("busyFit", [it], (x) => toSize(x, target))}
                          onMakeTarget={() => setTargetOverride({ width: it.width, height: it.height })}
                          onOptimize={() => run("busyCompress", [it], optimize)}
                          onOpen={() => setViewing(it)}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              ) : (
                <Preview items={items} settings={settings} target={target} />
              )}
            </>
          )}
        </main>

        <aside className="side">
          <h2>PDF</h2>
          <fieldset>
            <legend>{t.pageSize}</legend>
            {modes.map((m) => (
              <label key={m.value} className="radio">
                <input type="radio" name="mode" checked={settings.pageMode === m.value} onChange={() => set("pageMode", m.value)} />
                <span>
                  {m.label}
                  <small>{m.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span>{t.fitLabel}</span>
            <select value={settings.fit} onChange={(e) => set("fit", e.target.value as Settings["fit"])}>
              <option value="contain">{t.fitContain}</option>
              <option value="cover">{t.fitCover}</option>
              <option value="stretch">{t.fitStretch}</option>
            </select>
            <small>{t.fitHint}</small>
          </label>

          <div className="row">
            <label className="field">
              <span>{t.margin}</span>
              <input type="number" min={0} max={50} value={settings.margin} onChange={(e) => set("margin", Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="field">
              <span>{t.background}</span>
              <input type="color" value={settings.background} onChange={(e) => set("background", e.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>{t.fileName}</span>
            <div className="suffix">
              <input value={settings.fileName} onChange={(e) => set("fileName", e.target.value)} placeholder="images" />
              <span>.pdf</span>
            </div>
          </label>

          <p className="stats">{t.stats(items.length, formatBytes(totalBytes))}</p>
          <button className="primary" disabled={!items.length || !!busy} onClick={download}>
            {t.download}
          </button>
          <button disabled={!items.length || !!busy} onClick={openPdf}>
            {t.openPdf}
          </button>
          {busy === "busyPdf" ? (
            <div className="progress" role="status" aria-live="polite">
              <div className="progress-head">
                <span>
                  {pdfProgress?.stage === "save"
                    ? t.progressSave
                    : pdfProgress
                      ? t.progressPage(pdfProgress.done + 1, pdfProgress.total)
                      : t.busyPdf}
                </span>
                <button className="link" onClick={cancelPdf}>{t.cancel}</button>
              </div>
              <progress
                max={1}
                value={pdfProgress ? (pdfProgress.stage === "save" ? 0.9 : (0.9 * pdfProgress.done) / pdfProgress.total) : 0}
              />
              <small>{t.progressNote}</small>
            </div>
          ) : (
            busy && <p className="busy">{t[busy]}</p>
          )}
        </aside>
      </div>

      {dragFiles && <div className="dropping">{t.dropping}</div>}
      {viewing && (
        <div className="lightbox" onClick={() => setViewing(null)}>
          <img src={viewing.url} alt={viewing.name} />
          <span>{viewing.name} · {sizeKey(viewing)} · {formatBytes(viewing.size)}</span>
        </div>
      )}
      {!chosen && <LanguageDialog />}
    </div>
  );
}
