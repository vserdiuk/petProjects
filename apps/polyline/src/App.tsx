import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { PolylinePanel } from "./components/PolylinePanel";
import { DEFAULT_TABLE_SETTINGS, OrdersTable, type TableSettings } from "./components/OrdersTable";
import { alongOf, DEFAULT_COLUMNS, readPoint, type Order } from "./lib/orders";
import { sliceAlong } from "./lib/sampling";
import { timeZoneAt } from "./lib/time";
import { useAddressFill } from "./lib/useAddressFill";
import type { Precision } from "./lib/polyline";
import { load, save } from "./lib/storage";
import type { LngLat } from "./lib/types";

export function App() {
  const [coords, setCoords] = useState<LngLat[]>(() => load<LngLat[]>("coords", []));
  const [precision, setPrecision] = useState<Precision>(() => load<Precision>("precision", 5));
  const [drawMode, setDrawMode] = useState(true);
  const [fitToken, setFitToken] = useState(() => (coords.length ? 1 : 0));

  const [orders, setOrders] = useState<Order[]>(() => load<Order[]>("orders", []));
  const [tableSettings, setTableSettings] = useState<TableSettings>(() => ({
    ...DEFAULT_TABLE_SETTINGS,
    ...load<Partial<TableSettings>>("tableSettings", {}),
  }));
  const [columns, setColumns] = useState<string[]>(() => load<string[]>("columns", [...DEFAULT_COLUMNS]));
  useEffect(() => save("columns", columns), [columns]);
  const [hovered, setHovered] = useState<Order | null>(null);
  const highlight = useMemo(() => {
    if (!hovered) return null;
    const pickup = readPoint(hovered, "pickup");
    const dropoff = readPoint(hovered, "dropoff");
    const a = alongOf(hovered, "pickup", coords);
    const b = alongOf(hovered, "dropoff", coords);
    const route =
      pickup && dropoff && a != null && b != null ? [pickup, ...sliceAlong(coords, a, b), dropoff] : [];
    return { pickup, dropoff, route };
  }, [hovered, coords]);

  const geocoding = useAddressFill(orders, setOrders, tableSettings.autoAddresses);
  const detectedTimeZone = useMemo(() => (coords.length ? timeZoneAt(coords[0]) : null), [coords]);

  useEffect(() => save("coords", coords), [coords]);
  useEffect(() => save("orders", orders), [orders]);
  useEffect(() => save("tableSettings", tableSettings), [tableSettings]);
  useEffect(() => save("precision", precision), [precision]);

  // Input pasted into a text field: show the whole line.
  const onCoordsFromInput = useCallback((next: LngLat[]) => {
    setCoords(next);
    setFitToken((t) => t + 1);
  }, []);

  return (
    <div className="app">
      <header className="top">
        <a href="../" className="back">← All projects</a>
        <h1>Polyline delivery generator</h1>
      </header>
      <div className="part-a">
        <PolylinePanel
          coords={coords}
          precision={precision}
          drawMode={drawMode}
          onCoordsFromInput={onCoordsFromInput}
          onCoordsEdit={setCoords}
          onPrecisionChange={setPrecision}
          onDrawModeChange={setDrawMode}
        />
        <MapView coords={coords} onChange={setCoords} drawMode={drawMode} fitToken={fitToken} highlight={highlight} />
      </div>
      <OrdersTable
        coords={coords}
        detectedTimeZone={detectedTimeZone}
        orders={orders}
        onOrdersChange={setOrders}
        settings={tableSettings}
        onSettingsChange={setTableSettings}
        geocoding={geocoding}
        columns={columns}
        onColumnsChange={(nextColumns, nextOrders) => {
          setColumns(nextColumns);
          setOrders(nextOrders);
        }}
        onHoverOrder={setHovered}
      />
    </div>
  );
}
