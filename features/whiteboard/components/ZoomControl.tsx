"use client";

import { Icon } from "@/features/shared/icons/Icon";

interface ZoomControlProps {
  zoom: number;
  isPdfMode: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const buttonClass =
  "flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-accent-soft hover:text-ink";

export function ZoomControl({
  zoom,
  isPdfMode,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomControlProps) {
  return (
    <div
      className={`pointer-events-none absolute start-4 z-20 ${
        isPdfMode ? "bottom-[76px] md:bottom-4" : "bottom-4"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-border bg-surface p-1 shadow-panel">
        <button
          onClick={onZoomOut}
          title="تصغير"
          aria-label="تصغير"
          className={buttonClass}
        >
          <Icon name="minus" size={16} />
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-ink-soft">
          {Math.round(zoom * 100)}٪
        </span>
        <button
          onClick={onZoomIn}
          title="تكبير"
          aria-label="تكبير"
          className={buttonClass}
        >
          <Icon name="plus" size={16} />
        </button>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <button
          onClick={onReset}
          title={isPdfMode ? "ملاءمة الصفحة للشاشة" : "الحجم الطبيعي (100٪)"}
          aria-label={isPdfMode ? "ملاءمة الصفحة" : "الحجم الطبيعي"}
          className={buttonClass}
        >
          <Icon name={isPdfMode ? "fit" : "maximize"} size={16} />
        </button>
      </div>
    </div>
  );
}
