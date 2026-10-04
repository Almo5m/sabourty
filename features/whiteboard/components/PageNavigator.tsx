"use client";

import { Icon } from "@/features/shared/icons/Icon";
import { PdfPageState } from "@/features/boards/types";

interface PageNavigatorProps {
  pages: PdfPageState[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function PageNavigator({
  pages,
  currentIndex,
  onSelect,
}: PageNavigatorProps) {
  if (pages.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-panel">
        <button
          onClick={() => onSelect(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft disabled:opacity-30"
        >
          <Icon name="chevronRight" size={16} />
        </button>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {pages.map((page, index) => (
            <button
              key={index}
              onClick={() => onSelect(index)}
              className={`flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-paper text-[10px] text-ink-faint transition ${
                index === currentIndex
                  ? "border-ink"
                  : "border-border hover:border-border-strong"
              }`}
            >
              {page.backgroundDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.backgroundDataUrl}
                  alt={`صفحة ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                index + 1
              )}
            </button>
          ))}
        </div>

        <span className="shrink-0 px-1 text-xs text-ink-soft">
          {currentIndex + 1} / {pages.length}
        </span>

        <button
          onClick={() => onSelect(Math.min(pages.length - 1, currentIndex + 1))}
          disabled={currentIndex === pages.length - 1}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft disabled:opacity-30"
        >
          <Icon name="chevronLeft" size={16} />
        </button>
      </div>
    </div>
  );
}
