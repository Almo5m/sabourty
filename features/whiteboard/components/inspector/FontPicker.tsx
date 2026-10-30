"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_FONT_FAMILY } from "../../objects/node";
import {
  ARABIC_FONTS,
  CATEGORY_LABELS,
  FONTS,
  FontCategory,
  FontInfo,
  SYSTEM_FONT,
  loadFont,
  loadFontPreview,
} from "../../lib/fonts";

type Filter = FontCategory | "arabic" | "all";

const FILTERS: Filter[] = ["arabic", "all", "sans", "serif", "display", "handwriting", "mono"];
const ROW_HEIGHT = 38;
const VIEW_HEIGHT = 288;

interface FontPickerProps {
  value: string;
  onPick: (family: string) => void;
}

/**
 * منتقي الخطوط: كل خطوط جوجل (1900+) مع بحث وتصنيف. القائمة مقسّمة (windowed):
 * بنرسم الصفوف الظاهرة بس، وبنحمّل معاينة الخط (نسخة صغيرة جدًا) لما يظهر.
 */
export function FontPicker({ value, onPick }: FontPickerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("arabic");
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let source: FontInfo[];
    if (filter === "arabic") source = ARABIC_FONTS;
    else if (filter === "all") source = FONTS;
    else source = FONTS.filter((f) => f.category === filter);
    return q ? source.filter((f) => f.family.toLowerCase().includes(q)) : source;
  }, [query, filter]);

  const showSystem = !query.trim() && (filter === "arabic" || filter === "all");
  const total = rows.length + (showSystem ? 1 : 0);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScrollTop(0);
  }, [query, filter]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3);
  const last = Math.min(total, first + Math.ceil(VIEW_HEIGHT / ROW_HEIGHT) + 7);

  const items: { key: string; top: number; info: FontInfo | null }[] = [];
  for (let i = first; i < last; i++) {
    const isSystemRow = showSystem && i === 0;
    const info = isSystemRow ? null : rows[i - (showSystem ? 1 : 0)];
    items.push({ key: isSystemRow ? "system" : info!.family, top: i * ROW_HEIGHT, info });
  }

  useEffect(() => {
    items.forEach((item) => item.info && loadFontPreview(item.info.family));
  });

  return (
    <div className="w-[300px] max-w-full rounded-2xl border border-border bg-surface p-2.5 shadow-panel-lg">
      <input
        aria-label="ابحث عن خط"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`ابحث بين ${FONTS.length.toLocaleString("ar-EG")} خط...`}
        className="mb-2 w-full rounded-lg border border-border bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {FILTERS.map((id) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              filter === id ? "bg-accent text-white" : "bg-paper text-ink-soft hover:bg-accent-soft"
            }`}
          >
            {CATEGORY_LABELS[id]}
          </button>
        ))}
      </div>
      <div
        ref={listRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative overflow-y-auto"
        style={{ height: VIEW_HEIGHT }}
      >
        <div style={{ height: total * ROW_HEIGHT, position: "relative" }}>
          {items.map(({ key, top, info }) => {
            const family = info ? info.family : SYSTEM_FONT.family;
            const selected = value === family;
            return (
              <button
                key={key}
                onClick={() => {
                  if (info) void loadFont(info.family);
                  onPick(family);
                }}
                aria-label={info ? info.family : SYSTEM_FONT.label}
                className={`absolute inset-x-0 flex items-center justify-between rounded-lg px-3 text-start transition ${
                  selected ? "bg-accent-soft text-accent-strong" : "hover:bg-paper"
                }`}
                style={{ top, height: ROW_HEIGHT }}
              >
                <span
                  className="truncate text-base"
                  style={{ fontFamily: info ? `"${info.family}", sans-serif` : DEFAULT_FONT_FAMILY }}
                >
                  {info ? info.family : SYSTEM_FONT.label}
                </span>
                {info?.arabic && <span className="text-[10px] text-ink-faint">عربي</span>}
              </button>
            );
          })}
        </div>
        {total === 0 && (
          <p className="absolute inset-x-0 top-6 text-center text-xs text-ink-faint">لا توجد نتائج</p>
        )}
      </div>
    </div>
  );
}
