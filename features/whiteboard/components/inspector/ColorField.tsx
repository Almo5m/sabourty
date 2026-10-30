"use client";

import { Icon } from "@/features/shared/icons/Icon";
import { INK_PALETTE } from "../../types";
import { NOTE_COLORS } from "../../objects/nodeLooks";

/** ألوان التعبئة: بدون، ثم الباستيل، ثم ألوان الحبر الغامقة. */
const FILL_COLORS = [
  ...NOTE_COLORS.map((c) => c.fill),
  ...INK_PALETTE.map((c) => c.value),
].filter((value, index, all) => all.indexOf(value) === index);

interface ColorGridProps {
  value: string;
  onChange: (color: string) => void;
  /** يسمح بخيار "بدون لون" (شفاف) */
  allowNone?: boolean;
}

export function ColorGrid({ value, onChange, allowNone }: ColorGridProps) {
  const isNone = !value || value === "transparent";
  return (
    <div className="w-[272px] max-w-full rounded-2xl border border-border bg-surface p-3 shadow-panel-lg">
      <div className="flex flex-wrap gap-2">
        {allowNone && (
          <button
            aria-label="بدون لون"
            title="بدون لون"
            onClick={() => onChange("")}
            className={`relative h-8 w-8 overflow-hidden rounded-full border bg-white transition ${
              isNone ? "scale-110 border-ink ring-2 ring-accent/40" : "border-border-strong hover:scale-105"
            }`}
          >
            <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rotate-45 bg-danger" />
          </button>
        )}
        {FILL_COLORS.map((color) => {
          const selected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              aria-label={`لون ${color}`}
              onClick={() => onChange(color)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                selected ? "scale-110 border-ink ring-2 ring-accent/40" : "border-border-strong hover:scale-105"
              }`}
              style={{ background: color }}
            >
              {selected && (
                <Icon
                  name="check"
                  size={14}
                  className={color === "#ffffff" || NOTE_COLORS.some((n) => n.fill === color) ? "text-ink" : "text-white"}
                />
              )}
            </button>
          );
        })}
        <label
          title="لون مخصص"
          className="relative flex h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-border-strong"
          style={{
            background:
              "conic-gradient(#c8432f, #e8b229, #7d9a2e, #1b8aa0, #5a4fcf, #d1427f, #c8432f)",
          }}
        >
          <input
            type="color"
            aria-label="لون مخصص"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#1f6f63"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

/** زرار صغير بيعرض اللون الحالي (مربع بخلفية شطرنج لو شفاف). */
export function ColorDot({ color }: { color: string }) {
  const none = !color || color === "transparent";
  return (
    <span
      className="relative block h-5 w-5 overflow-hidden rounded-full border border-border-strong"
      style={{ background: none ? "#fff" : color }}
    >
      {none && <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rotate-45 bg-danger" />}
    </span>
  );
}
