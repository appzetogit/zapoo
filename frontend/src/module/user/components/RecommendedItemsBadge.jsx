import React, { useMemo, useRef } from "react";

function formatPrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return "";
  return `₹${Math.round(n)}`;
}

function clampItems(items, max = 5) {
  if (!Array.isArray(items)) return [];
  return items.filter(Boolean).slice(0, max);
}

function ItemTextOnly({ item }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-white text-xs font-medium leading-tight">
        {(item?.name || "").trim() || "Item"}
      </span>
      <span className="text-white/90 text-xs font-semibold leading-tight">
        {formatPrice(item?.price) || ""}
      </span>
    </div>
  );
}

/**
 * Renders a pill/overlay similar to the old featured dish badge,
 * but shows 1..N recommended items (N<=5). If N>1, it becomes a mini slider.
 */
export default function RecommendedItemsBadge({ items, fallbackText }) {
  const list = useMemo(() => clampItems(items, 5), [items]);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);

  if (!list || list.length === 0) {
    if (!fallbackText) return null;
    return (
      <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center shadow-lg">
        {fallbackText}
      </div>
    );
  }

  if (list.length === 1) {
    return (
      <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center shadow-lg w-fit max-w-[calc(100%-0.5rem)]">
        <ItemTextOnly item={list[0]} />
      </div>
    );
  }

  return (
    <div
      className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center shadow-lg w-fit max-w-[calc(100%-0.5rem)]"
      onPointerDown={(e) => {
        startXRef.current = e.clientX;
        isDraggingRef.current = false;
      }}
      onPointerMove={(e) => {
        const dx = Math.abs(e.clientX - startXRef.current);
        if (dx > 6) {
          isDraggingRef.current = true;
          // avoid accidental navigation when user is swiping inside slider
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (isDraggingRef.current) {
          e.preventDefault();
          e.stopPropagation();
          isDraggingRef.current = false;
        }
      }}
    >
      <div
        className="flex items-center gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {list.map((it) => (
          <div key={it.itemId || it.name} className="snap-start">
            <ItemTextOnly item={it} />
          </div>
        ))}
      </div>
    </div>
  );
}

