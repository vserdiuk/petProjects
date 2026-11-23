import { useMemo, useState } from "react";
import {
  createOrder,
  DEFAULT_COLUMNS,
  editCell,
  endIsManual,
  nextId,
  regenerateEnd,
  type End,
  type GenerateSettings,
  type Order,
} from "../lib/orders";
import { SamplingError } from "../lib/sampling";
import { downloadText, toCsv } from "../lib/csv";
import { browserTimeZone, isValidTimeZone } from "../lib/time";
import type { LngLat } from "../lib/types";

export type TableSettings = {
  bufferM: number;
  minGapKm: number;
  windowHours: number;
  /** Empty = detect from the polyline. */
  timeZoneOverride: string;
  batchSize: number;
  /** Fill addresses through Nominatim. */
  autoAddresses: boolean;
};

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  bufferM: 10,
  minGapKm: 2,
  windowHours: 8,
  timeZoneOverride: "",
  batchSize: 10,
  autoAddresses: true,
};

type Props = {
  coords: LngLat[];
  detectedTimeZone: string | null;
  orders: Order[];
  onOrdersChange: (next: Order[]) => void;
  settings: TableSettings;
  onSettingsChange: (s: TableSettings) => void;
  geocoding: { pending: number; failed: number; stop: () => void; retry: () => void };
};

const MAX_BATCH = 500;

const ALL_ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return [];
  }
})();

export function OrdersTable({
  coords,
  detectedTimeZone,
  orders,
  onOrdersChange,
  settings,
  onSettingsChange,
  geocoding,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const columns = DEFAULT_COLUMNS as readonly string[];

  const override = settings.timeZoneOverride.trim();
  const overrideValid = override === "" || isValidTimeZone(override);
  const timeZone = (override && overrideValid ? override : null) ?? detectedTimeZone ?? browserTimeZone();

  const genSettings: GenerateSettings = useMemo(
    () => ({
      bufferM: Math.max(0, settings.bufferM),
      minGapM: Math.max(0, settings.minGapKm) * 1000,
      windowHours: settings.windowHours,
      timeZone,
    }),
    [settings, timeZone],
  );

  const guard = (fn: () => void) => {
    try {
      fn();
      setError(null);
    } catch (err) {
      if (err instanceof SamplingError) setError(err.message);
      else throw err;
    }
  };

  const addRows = (n: number) =>
    guard(() => {
      const now = new Date();
      const start = nextId(orders);
      const created: Order[] = [];
      for (let i = 0; i < n; i++) created.push(createOrder(start + i, [...columns], coords, genSettings, now));
      onOrdersChange([...orders, ...created]);
    });

  const regen = (key: string, end: End) =>
    guard(() => onOrdersChange(orders.map((o) => (o.key === key ? regenerateEnd(o, end, coords, genSettings) : o))));

  const update = (key: string, col: string, value: string) =>
    onOrdersChange(orders.map((o) => (o.key === key ? editCell(o, col, value) : o)));

  const remove = (key: string) => onOrdersChange(orders.filter((o) => o.key !== key));

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    downloadText(`orders-${stamp}.csv`, toCsv([...columns], orders.map((o) => columns.map((c) => o.values[c] ?? ""))));
  };

  const set = <K extends keyof TableSettings>(k: K, v: TableSettings[K]) => onSettingsChange({ ...settings, [k]: v });
  const num = (v: string, fallback: number) => (v === "" || Number.isNaN(Number(v)) ? fallback : Number(v));

  return (
    <section className="orders">
      <div className="orders-bar">
        <label>
          Distance from line, m
          <input type="number" min={0} value={settings.bufferM} onChange={(e) => set("bufferM", num(e.target.value, 0))} />
        </label>
        <label>
          Min pickup→dropoff, km
          <input type="number" min={0} step={0.5} value={settings.minGapKm} onChange={(e) => set("minGapKm", num(e.target.value, 0))} />
        </label>
        <label>
          Window, h
          <input type="number" min={0} step={0.5} value={settings.windowHours} onChange={(e) => set("windowHours", num(e.target.value, 0))} />
        </label>
        <label className="tz">
          Time zone
          <input
            list="tz-list"
            value={settings.timeZoneOverride}
            placeholder={detectedTimeZone ? `${detectedTimeZone} (auto)` : `${browserTimeZone()} (browser)`}
            aria-invalid={!overrideValid}
            onChange={(e) => set("timeZoneOverride", e.target.value)}
          />
          <datalist id="tz-list">
            {ALL_ZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
        <span className="spacer" />
        <label className="inline">
          <input
            type="number"
            min={1}
            max={MAX_BATCH}
            value={settings.batchSize}
            onChange={(e) => set("batchSize", Math.min(MAX_BATCH, Math.max(1, num(e.target.value, 1))))}
          />
          <button type="button" onClick={() => addRows(settings.batchSize)}>
            Generate rows
          </button>
        </label>
        <button type="button" disabled={!orders.length} onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" disabled={!orders.length} onClick={() => onOrdersChange([])}>
          Clear table
        </button>
      </div>
      <div className="geo-bar">
        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoAddresses}
            onChange={(e) => {
              if (!e.target.checked) geocoding.stop();
              set("autoAddresses", e.target.checked);
            }}
          />
          Fill addresses (OpenStreetMap Nominatim, 1 request/s)
        </label>
        {geocoding.pending > 0 && (
          <span className="geo-status" role="status">
            <span className="spinner" aria-hidden /> Looking up {geocoding.pending} point{geocoding.pending === 1 ? "" : "s"}…
            <button
              type="button"
              onClick={() => {
                geocoding.stop();
                set("autoAddresses", false);
              }}
            >
              Stop
            </button>
          </span>
        )}
        {geocoding.failed > 0 && geocoding.pending === 0 && (
          <span className="geo-status error">
            {geocoding.failed} lookup{geocoding.failed === 1 ? "" : "s"} failed
            <button type="button" onClick={geocoding.retry}>
              Retry
            </button>
          </span>
        )}
      </div>
      {!overrideValid && <p className="error">Unknown time zone "{override}", using {timeZone}.</p>}
      {error && <p className="error banner">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="actions">
                <button type="button" className="add" title="Add a generated row" onClick={() => addRows(1)}>
                  +
                </button>
              </th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td className="empty" colSpan={columns.length + 1}>
                  Press + to generate an order along the polyline.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.key}>
                <td className="actions">
                  <button
                    type="button"
                    title={endIsManual(o, "pickup") ? "Pickup coordinates were set by hand" : "New pickup"}
                    disabled={endIsManual(o, "pickup")}
                    onClick={() => regen(o.key, "pickup")}
                  >
                    ↻P
                  </button>
                  <button
                    type="button"
                    title={endIsManual(o, "dropoff") ? "Dropoff coordinates were set by hand" : "New dropoff"}
                    disabled={endIsManual(o, "dropoff")}
                    onClick={() => regen(o.key, "dropoff")}
                  >
                    ↻D
                  </button>
                  <button type="button" title="Delete row" onClick={() => remove(o.key)}>
                    ✕
                  </button>
                </td>
                {columns.map((c) => (
                  <td key={c} className={o.manual.includes(c) ? "manual" : undefined}>
                    <input
                      aria-label={`${c} row ${o.values.id}`}
                      value={o.values[c] ?? ""}
                      style={{ width: `calc(${Math.max(c === "id" ? 3 : 10, (o.values[c] ?? "").length)}ch + 18px)` }}
                      onChange={(e) => update(o.key, c, e.target.value)}
                      title={o.manual.includes(c) ? "Edited by hand: generation keeps it. Clear the cell to release it." : undefined}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        {orders.length} rows · time zone {timeZone}. Cells you edit by hand (marked) are never overwritten by
        generation; clear a cell to release it.
      </p>
    </section>
  );
}
