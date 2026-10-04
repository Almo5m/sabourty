"use client";

import { Icon } from "@/features/shared/icons/Icon";

interface ZoomControlProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControl({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomControlProps) {
  return (
    <div className="pointer-events-none absolute bottom-4 start-4 z-20">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-border bg-surface p-1.5 shadow-panel">
        <button
          onClick={onZoomOut}
          title="تصغير"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-ink"
        >
          <Icon name="minus" size={15} />
        </button>
        <span className="w-11 text-center text-xs tabular-nums text-ink-soft">
          {Math.round(zoom * 100)}٪
        </span>
        <button
          onClick={onZoomIn}
          title="تكبير"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-ink"
        >
          <Icon name="plus" size={15} />
        </button>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <button
          onClick={onReset}
          title="ملء الشاشة (100٪)"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-ink"
        >
          <Icon name="maximize" size={15} />
        </button>
      </div>
    </div>
  );
}
