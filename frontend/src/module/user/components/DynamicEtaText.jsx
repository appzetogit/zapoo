import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useLocation } from "../hooks/useLocation";

const etaCache = new Map();

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildItemsSignature(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const normalized = items
    .map((it) => ({
      itemId: String(it?.itemId ?? it?.id ?? ""),
      quantity: Number(it?.quantity || 0),
    }))
    .filter((it) => it.itemId && it.quantity > 0)
    .sort((a, b) => (a.itemId > b.itemId ? 1 : -1));
  return JSON.stringify(normalized);
}

/**
 * Dynamic ETA text using backend Quote ETA.
 * - Listing: pass only restaurantId (items omitted)
 * - Cart: pass items [{ itemId, quantity }]
 */
export default function DynamicEtaText({
  restaurantId,
  items = null,
  fallback = "25-30 mins",
  className = "",
}) {
  const { location } = useLocation();
  const [text, setText] = useState(fallback);

  const lat = toNumberOrNull(location?.latitude);
  const lng = toNumberOrNull(location?.longitude);

  const itemsSig = useMemo(() => buildItemsSignature(items), [items]);
  const cacheKey = useMemo(() => {
    if (!restaurantId || lat == null || lng == null) return null;
    // Round user coords to reduce cache fragmentation while keeping accuracy.
    const latKey = lat.toFixed(3);
    const lngKey = lng.toFixed(3);
    return `${restaurantId}|${latKey},${lngKey}|${itemsSig}`;
  }, [restaurantId, lat, lng, itemsSig]);

  useEffect(() => {
    let cancelled = false;
    if (!cacheKey) {
      setText(fallback);
      return () => {
        cancelled = true;
      };
    }

    const cached = etaCache.get(cacheKey);
    if (cached && (Date.now() - cached.at) < 60_000) {
      setText(cached.text);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const payload = {
          restaurantId,
          userLocation: { latitude: lat, longitude: lng },
        };
        if (itemsSig) {
          payload.items = JSON.parse(itemsSig);
        }

        const res = await api.post("/orders/quote-eta", payload);
        const data = res?.data?.data;
        const minETA = Number(data?.minETA);
        const maxETA = Number(data?.maxETA);
        const nextText =
          Number.isFinite(minETA) && Number.isFinite(maxETA)
            ? `${minETA}-${maxETA} mins`
            : fallback;

        etaCache.set(cacheKey, { at: Date.now(), text: nextText });
        if (!cancelled) setText(nextText);
      } catch (_) {
        if (!cancelled) setText(fallback);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, restaurantId, lat, lng, itemsSig, fallback]);

  return <span className={className}>{text}</span>;
}
