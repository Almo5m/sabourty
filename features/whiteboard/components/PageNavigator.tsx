"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/features/shared/icons/Icon";

interface PageNavigatorProps {
  pageCount: number;
  currentIndex: number;
  onSelect: (index: number) => void;
  loadThumbnail: (index: number) => Promise<string | null>;
}

function PageThumb({
  index,
  active,
  loadThumbnail,
  onSelect,
}: {
  index: number;
  active: boolean;
  loadThumbnail: (index: number) => Promise<string | null>;
  onSelect: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLButtonElement | null>(null);

  // المصغّرات بتتحمّل لما تظهر في الشاشة بس، عشان ملف بـ 100 صفحة ما يحمّلش كله مرة واحدة
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      loadThumbnail(index).then((result) => {
        if (!cancelled) setUrl(result);
      });
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [index, loadThumbnail]);

  return (
    <button
      ref={ref}
      onClick={onSelect}
      aria-label={`صفحة ${index + 1}`}
      className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border-2 bg-paper text-xs text-ink-faint transition ${
        active ? "border-accent" : "border-border hover:border-border-strong"
      }`}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <span className="absolute bottom-0.5 end-1 rounded bg-surface/90 px-1 text-[10px] tabular-nums text-ink-soft">
        {index + 1}
      </span>
    </button>
  );
}

export function PageNavigator({
  pageCount,
  currentIndex,
  onSelect,
  loadThumbnail,
}: PageNavigatorProps) {
  const [gridOpen, setGridOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  if (pageCount === 0) return null;

  const commitDraft = () => {
    const value = Number(draft);
    setDraft(null);
    if (Number.isInteger(value) && value >= 1 && value <= pageCount) {
      onSelect(value - 1);
    }
  };

  const arrowClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition hover:bg-accent-soft disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <>
      {gridOpen && (
        <>
          <button
            aria-label="إغلاق قائمة الصفحات"
            className="absolute inset-0 z-20 cursor-default"
            onClick={() => setGridOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-[72px] z-30 flex justify-center px-3">
            <div className="grid max-h-[55vh] w-full max-w-lg grid-cols-4 gap-2 overflow-y-auto rounded-2xl border border-border bg-surface p-3 shadow-panel-lg sm:grid-cols-6">
              {Array.from({ length: pageCount }, (_, index) => (
                <PageThumb
                  key={index}
                  index={index}
                  active={index === currentIndex}
                  loadThumbnail={loadThumbnail}
                  onSelect={() => {
                    setGridOpen(false);
                    onSelect(index);
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-surface p-1 shadow-panel">
          <button
            aria-label="الصفحة السابقة"
            onClick={() => onSelect(currentIndex - 1)}
            disabled={currentIndex === 0}
            className={arrowClass}
          >
            <Icon name="chevronRight" size={16} />
          </button>

          <div dir="ltr" className="flex items-center gap-1 px-1 text-sm text-ink-soft">
            <input
              aria-label="رقم الصفحة"
              inputMode="numeric"
              value={draft ?? String(currentIndex + 1)}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setDraft(null);
                  e.currentTarget.blur();
                }
              }}
              className="w-10 rounded-md bg-paper py-1 text-center tabular-nums text-ink outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="tabular-nums">/ {pageCount}</span>
          </div>

          <button
            aria-label="كل الصفحات"
            title="كل الصفحات"
            onClick={() => setGridOpen((v) => !v)}
            className={`${arrowClass} ${gridOpen ? "bg-accent-soft text-accent-strong" : ""}`}
          >
            <Icon name="pages" size={17} />
          </button>

          <button
            aria-label="الصفحة التالية"
            onClick={() => onSelect(currentIndex + 1)}
            disabled={currentIndex === pageCount - 1}
            className={arrowClass}
          >
            <Icon name="chevronLeft" size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
