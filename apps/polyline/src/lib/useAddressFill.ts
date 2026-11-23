import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { CancelledError, Geocoder, cacheKey, type Address } from "./geocode";
import { addressJobs, applyAddress, type Order } from "./orders";
import { load, save } from "./storage";

const CACHE_LIMIT = 3000;

function makeGeocoder(): Geocoder {
  const cache = new Map<string, Address>(load<[string, Address][]>("geocodeCache", []));
  return new Geocoder({ cache });
}

/**
 * Watches the table and fills empty address cells through Nominatim, one
 * request per second. Each (row, end, point) is tried once until `retry()`.
 */
export function useAddressFill(
  orders: Order[],
  setOrders: Dispatch<SetStateAction<Order[]>>,
  enabled: boolean,
) {
  const geocoder = useRef<Geocoder>(null as unknown as Geocoder);
  if (!geocoder.current) geocoder.current = makeGeocoder();
  const tried = useRef(new Set<string>());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const g = geocoder.current;
    g.onChange = () => setPending(g.pending);
    return () => {
      g.onChange = () => {};
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const g = geocoder.current;
    for (const job of addressJobs(orders)) {
      const id = `${job.key}|${job.end}|${cacheKey(job.point)}`;
      if (tried.current.has(id)) continue;
      tried.current.add(id);
      g.reverse(job.point).then(
        (address) => {
          setOrders((prev) => prev.map((o) => (o.key === job.key ? applyAddress(o, job.end, job.point, address) : o)));
          const entries = [...g.cache.entries()];
          save("geocodeCache", entries.slice(-CACHE_LIMIT));
        },
        (err) => {
          if (err instanceof CancelledError) tried.current.delete(id);
          else setFailed((n) => n + 1);
        },
      );
    }
  }, [orders, enabled, retryToken, setOrders]);

  const stop = useCallback(() => geocoder.current.cancel(), []);

  const retry = useCallback(() => {
    tried.current.clear();
    setFailed(0);
    setRetryToken((t) => t + 1);
  }, []);

  return { pending, failed, stop, retry };
}
