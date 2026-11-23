import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { PolylinePanel } from "./components/PolylinePanel";
import { DEFAULT_TABLE_SETTINGS, OrdersTable, type TableSettings } from "./components/OrdersTable";
import { DEFAULT_COLUMNS, readPoint, type Order } from "./lib/orders";
import { roadRoute } from "./lib/route";
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
  const [roadPath, setRoadPath] = useState<{ id: string; coords: LngLat[] | null } | null>(null);
  const ends = useMemo(() => {
    if (!hovered) return null;
    return { pickup: readPoint(hovered, "pickup"), dropoff: readPoint(hovered, "dropoff") };
  }, [hovered]);
  const endsId = ends?.pickup && ends.dropoff ? `${ends.pickup};${ends.dropoff}` : null;

  // Road route for the hovered row (debounced so sweeping over rows does not flood OSRM).
  useEffect(() => {
    if (tableSettings.routeMode !== "road" || !endsId || !ends?.pickup || !ends.dropoff) return;
    const { pickup, dropoff } = ends;
    let alive = true;
    const t = setTimeout(() => {
      roadRoute(pickup, dropoff).then(
        (coords) => alive && setRoadPath({ id: endsId, coords }),
        () => alive && setRoadPath({ id: endsId, coords: null }),
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [endsId, ends, tableSettings.routeMode]);

  const highlight = useMemo(() => {
    if (!ends) return null;
    const { pickup, dropoff } = ends;
    if (!pickup || !dropoff) return { pickup, dropoff, route: [], dashed: true };
    const road = tableSettings.routeMode === "road" && roadPath?.id === endsId ? roadPath.coords : null;
    return road ? { pickup, dropoff, route: road, dashed: false } : { pickup, dropoff, route: [pickup, dropoff], dashed: true };
  }, [ends, endsId, roadPath, tableSettings.routeMode]);
  const routeStatus =
    tableSettings.routeMode === "road" && endsId
      ? roadPath?.id !== endsId
        ? "loading"
        : roadPath.coords
          ? "ok"
          : "failed"
      : null;

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
        routeStatus={routeStatus}
      />
    </div>
  );
}
