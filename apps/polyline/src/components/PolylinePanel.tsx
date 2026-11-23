import { useEffect, useState } from "react";
import { decodePolyline, encodePolyline, type Precision } from "../lib/polyline";
import { formatCoordinates, parseCoordinates } from "../lib/geojson";
import { lineLength } from "../lib/geo";
import { closedRing } from "../lib/zone";
import type { LngLat } from "../lib/types";
import { MAX_EDITABLE_VERTICES } from "./MapView";

type Props = {
  coords: LngLat[];
  precision: Precision;
  drawMode: boolean;
  onCoordsFromInput: (coords: LngLat[]) => void;
  onCoordsEdit: (coords: LngLat[]) => void;
  onPrecisionChange: (p: Precision) => void;
  onDrawModeChange: (v: boolean) => void;
};

type Field = "encoded" | "geojson";

export function PolylinePanel(props: Props) {
  const { coords, precision, drawMode } = props;
  const [encoded, setEncoded] = useState(() => encodePolyline(coords, precision));
  const [geojson, setGeojson] = useState(() => formatCoordinates(coords));
  const [errors, setErrors] = useState<Record<Field, string | null>>({ encoded: null, geojson: null });
  const [editing, setEditing] = useState<Field | null>(null);

  // When coords change from elsewhere (map, other field), refresh the fields
  // that the user is not typing into right now.
  useEffect(() => {
    if (editing !== "encoded") setEncoded(encodePolyline(coords, precision));
    if (editing !== "geojson") setGeojson(formatCoordinates(coords));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, precision]);

  const onEncodedInput = (value: string) => {
    setEncoded(value);
    try {
      const next = decodePolyline(value, precision);
      setErrors((e) => ({ ...e, encoded: null }));
      props.onCoordsFromInput(next);
    } catch (err) {
      setErrors((e) => ({ ...e, encoded: (err as Error).message }));
    }
  };

  const onGeojsonInput = (value: string) => {
    setGeojson(value);
    if (value.trim() === "") {
      setErrors((e) => ({ ...e, geojson: null }));
      props.onCoordsFromInput([]);
      return;
    }
    try {
      const next = parseCoordinates(value);
      setErrors((e) => ({ ...e, geojson: null }));
      props.onCoordsFromInput(next);
    } catch (err) {
      setErrors((e) => ({ ...e, geojson: (err as Error).message }));
    }
  };

  const onPrecision = (p: Precision) => {
    // Keep the encoded string the user typed and re-interpret it with the new precision.
    props.onPrecisionChange(p);
    if (encoded.trim()) {
      try {
        props.onCoordsFromInput(decodePolyline(encoded, p));
        setErrors((e) => ({ ...e, encoded: null }));
      } catch (err) {
        setErrors((e) => ({ ...e, encoded: (err as Error).message }));
      }
    }
  };

  const km = lineLength(closedRing(coords)) / 1000;

  return (
    <section className="panel">
      <div className="field">
        <div className="field-head">
          <label htmlFor="encoded">Encoded polyline</label>
          <div className="seg" role="group" aria-label="Precision">
            {([5, 6] as Precision[]).map((p) => (
              <button
                key={p}
                type="button"
                className={p === precision ? "on" : ""}
                onClick={() => onPrecision(p)}
                title={p === 5 ? "Google (1e5)" : "OSRM / Valhalla (1e6)"}
              >
                1e{p}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="encoded"
          spellCheck={false}
          rows={4}
          value={encoded}
          aria-invalid={!!errors.encoded}
          onFocus={() => setEditing("encoded")}
          onBlur={() => {
            setEditing(null);
            if (!errors.encoded) setEncoded(encodePolyline(coords, precision));
          }}
          onChange={(e) => onEncodedInput(e.target.value)}
          placeholder="_p~iF~ps|U_ulLnnqC_mqNvxq`@"
        />
        {errors.encoded && <p className="error">{errors.encoded}</p>}
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor="geojson">GeoJSON coordinates [lng, lat]</label>
        </div>
        <textarea
          id="geojson"
          spellCheck={false}
          rows={6}
          value={geojson}
          aria-invalid={!!errors.geojson}
          onFocus={() => setEditing("geojson")}
          onBlur={() => {
            setEditing(null);
            if (!errors.geojson) setGeojson(formatCoordinates(coords));
          }}
          onChange={(e) => onGeojsonInput(e.target.value)}
          placeholder='[[-87.6689,41.8728],[-87.6806,41.8400]] or {"type":"LineString",...}'
        />
        {errors.geojson && <p className="error">{errors.geojson}</p>}
      </div>

      <div className="toolbar">
        <label className="check">
          <input type="checkbox" checked={drawMode} onChange={(e) => props.onDrawModeChange(e.target.checked)} />
          Click map to add points
        </label>
        <button type="button" disabled={!coords.length} onClick={() => props.onCoordsEdit(coords.slice(0, -1))}>
          Undo last
        </button>
        <button type="button" disabled={coords.length < 2} onClick={() => props.onCoordsEdit(coords.slice().reverse())}>
          Reverse
        </button>
        <button type="button" disabled={!coords.length} onClick={() => props.onCoordsEdit([])}>
          Clear
        </button>
      </div>

      <p className="stats">
        {coords.length} points · zone perimeter {km.toFixed(2)} km
        {coords.length > MAX_EDITABLE_VERTICES && ` · editing on map is off above ${MAX_EDITABLE_VERTICES} points`}
      </p>
      <p className="hint">The polyline outlines the delivery zone (it closes automatically). Drag a point to move it, right-click a point to delete it.</p>
    </section>
  );
}
