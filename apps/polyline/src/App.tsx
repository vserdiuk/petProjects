import { useCallback, useEffect, useState } from "react";
import { MapView } from "./components/MapView";
import { PolylinePanel } from "./components/PolylinePanel";
import type { Precision } from "./lib/polyline";
import { load, save } from "./lib/storage";
import type { LngLat } from "./lib/types";

export function App() {
  const [coords, setCoords] = useState<LngLat[]>(() => load<LngLat[]>("coords", []));
  const [precision, setPrecision] = useState<Precision>(() => load<Precision>("precision", 5));
  const [drawMode, setDrawMode] = useState(true);
  const [fitToken, setFitToken] = useState(() => (coords.length ? 1 : 0));

  useEffect(() => save("coords", coords), [coords]);
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
        <MapView coords={coords} onChange={setCoords} drawMode={drawMode} fitToken={fitToken} />
      </div>
      <section className="part-b placeholder">
        Orders table (pickup / dropoff generator) arrives in the next stage.
      </section>
    </div>
  );
}
