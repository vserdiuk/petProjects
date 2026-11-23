import { useEffect, useRef } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre v6 ships its worker as a separate module; let Vite bundle it and hand over the URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Feature, FeatureCollection } from "geojson";
import type { LngLat } from "../lib/types";
import { closedRing } from "../lib/zone";

/** Above this many vertices, points are drawn but not individually editable (performance). */
export const MAX_EDITABLE_VERTICES = 500;

setWorkerUrl(workerUrl);

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

type Props = {
  coords: LngLat[];
  onChange: (coords: LngLat[]) => void;
  drawMode: boolean;
  /** Incremented by the parent to request fitting the map to the line. */
  fitToken: number;
  /** Order under the mouse: its pickup, dropoff and the route between them. */
  highlight?: { pickup: LngLat | null; dropoff: LngLat | null; route: LngLat[]; dashed: boolean } | null;
};

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

function highlightData(h: Props["highlight"]): FeatureCollection {
  if (!h) return EMPTY_FC;
  const features: Feature[] = [];
  if (h.route.length >= 2) {
    features.push({ type: "Feature", properties: { kind: "route", dashed: h.dashed }, geometry: { type: "LineString", coordinates: h.route } });
  }
  if (h.pickup) features.push({ type: "Feature", properties: { kind: "pickup", label: "P" }, geometry: { type: "Point", coordinates: h.pickup } });
  if (h.dropoff) features.push({ type: "Feature", properties: { kind: "dropoff", label: "D" }, geometry: { type: "Point", coordinates: h.dropoff } });
  return { type: "FeatureCollection", features };
}

/** The zone outline (closed once it has 3+ points) and its fill. */
const lineFeature = (coords: LngLat[]): FeatureCollection => {
  const ring = closedRing(coords);
  const features: Feature[] = [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } }];
  if (ring.length >= 4) features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });
  return { type: "FeatureCollection", features };
};

const pointsFeatureCollection = (coords: LngLat[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: coords.map((c, i) => ({
    type: "Feature",
    properties: { i },
    geometry: { type: "Point", coordinates: c },
  })),
});

export function MapView({ coords, onChange, drawMode, fitToken, highlight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const loadedRef = useRef(false);
  const syncRef = useRef<() => void>(() => {});
  const highlightRef = useRef<() => void>(() => {});

  // Latest props for map event handlers registered once.
  const latest = useRef({ coords, onChange, drawMode });
  latest.current = { coords, onChange, drawMode };

  // Create the map once.
  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: OSM_STYLE,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.doubleClickZoom.disable();

    map.on("load", () => {
      map.addSource("line", { type: "geojson", data: lineFeature([]) });
      map.addSource("vertices", { type: "geojson", data: pointsFeatureCollection([]) });
      map.addLayer({
        id: "zone-fill",
        type: "fill",
        source: "line",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#2f6fed", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "line-casing",
        type: "line",
        source: "line",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7 },
      });
      map.addLayer({
        id: "line",
        type: "line",
        source: "line",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2f6fed", "line-width": 4 },
      });
      map.addLayer({
        id: "vertices",
        type: "circle",
        source: "vertices",
        paint: {
          "circle-radius": 3,
          "circle-color": "#2f6fed",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });
      map.addSource("highlight", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "highlight-route",
        type: "line",
        source: "highlight",
        filter: ["all", ["==", ["get", "kind"], "route"], ["!", ["get", "dashed"]]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#f08c00", "line-width": 6, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "highlight-straight",
        type: "line",
        source: "highlight",
        filter: ["all", ["==", ["get", "kind"], "route"], ["get", "dashed"]],
        paint: { "line-color": "#f08c00", "line-width": 4, "line-dasharray": [2, 1.5] },
      });
      map.addLayer({
        id: "highlight-points",
        type: "circle",
        source: "highlight",
        filter: ["!=", ["get", "kind"], "route"],
        paint: {
          "circle-radius": 9,
          "circle-color": ["match", ["get", "kind"], "pickup", "#1f9d55", "#d92d20"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      loadedRef.current = true;
      highlightRef.current();
      syncRef.current();
    });

    map.on("click", (e) => {
      const { coords, onChange, drawMode } = latest.current;
      if (!drawMode) return;
      onChange([...coords, [e.lngLat.lng, e.lngLat.lat]]);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // Sync line, vertex layer and draggable markers with coords.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      if (!loadedRef.current) return;
      (map.getSource("line") as GeoJSONSource).setData(lineFeature(coords));
      const editable = coords.length <= MAX_EDITABLE_VERTICES;
      (map.getSource("vertices") as GeoJSONSource).setData(
        pointsFeatureCollection(editable ? [] : coords),
      );

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (!editable) return;

      coords.forEach((c, i) => {
        const el = document.createElement("div");
        el.className = "vertex" + (i === 0 ? " first" : i === coords.length - 1 ? " last" : "");
        el.title = `#${i + 1} · drag to move · right-click to delete`;
        el.addEventListener("click", (ev) => ev.stopPropagation());
        el.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const { coords, onChange } = latest.current;
          onChange(coords.filter((_, j) => j !== i));
        });
        const marker = new Marker({ element: el, draggable: true })
          .setLngLat(c)
          .addTo(map);
        marker.on("drag", () => {
          const { lng, lat } = marker.getLngLat();
          const next = latest.current.coords.slice();
          next[i] = [lng, lat];
          (map.getSource("line") as GeoJSONSource).setData(lineFeature(next));
        });
        marker.on("dragend", () => {
          const { lng, lat } = marker.getLngLat();
          const { coords, onChange } = latest.current;
          const next = coords.slice();
          next[i] = [lng, lat];
          onChange(next);
        });
        markersRef.current.push(marker);
      });
    };

    syncRef.current = sync;
    sync();
  }, [coords]);

  // Fit to the line when the parent asks.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitToken === 0 || coords.length === 0) return;
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new LngLatBounds(coords[0], coords[0]),
    );
    map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken]);

  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!map || !loadedRef.current) return;
      (map.getSource("highlight") as GeoJSONSource).setData(highlightData(highlight));
    };
    highlightRef.current = apply;
    apply();
  }, [highlight]);

  useEffect(() => {
    mapRef.current?.getCanvas().style.setProperty("cursor", drawMode ? "crosshair" : "");
  }, [drawMode]);

  return <div ref={containerRef} className="map" />;
}
