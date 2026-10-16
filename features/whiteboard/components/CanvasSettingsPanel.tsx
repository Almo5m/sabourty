"use client";

import { Icon } from "@/features/shared/icons/Icon";
import {
  BACKGROUND_PRESETS,
  CanvasSettings,
  GRID_OPTIONS,
  isDarkColor,
} from "../lib/canvasAppearance";

interface CanvasSettingsPanelProps {
  open: boolean;
  settings: CanvasSettings;
  /** في وضع PDF الخلفية والشبكة مش قابلة للتغيير (الصفحة هي الخلفية) */
  disabled: boolean;
  onChange: (next: CanvasSettings) => void;
  onClose: () => void;
}

export function CanvasSettingsPanel({
  open,
  settings,
  disabled,
  onChange,
  onClose,
}: CanvasSettingsPanelProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-none absolute end-4 top-16 z-20 flex w-72">
      <div className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-panel-lg">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Icon name="settings" size={16} className="text-ink-soft" />
          <h2 className="text-sm font-semibold text-ink">إعدادات اللوحة</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="ms-auto flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-paper hover:text-ink"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4">
          {disabled && (
            <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
              في وضع PDF الصفحة نفسها هي الخلفية، فالإعدادات دي بتنطبق على
              اللوحات الحرة بس.
            </p>
          )}

          <section className={disabled ? "pointer-events-none opacity-40" : ""}>
            <h3 className="mb-2 text-xs font-medium text-ink-soft">
              لون الخلفية
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {BACKGROUND_PRESETS.map((p) => (
                <button
                  key={p.value}
                  title={p.label}
                  aria-label={p.label}
                  onClick={() => onChange({ ...settings, background: p.value })}
                  className={`h-8 w-8 rounded-full border transition ${
                    settings.background.toLowerCase() === p.value
                      ? "ring-2 ring-accent ring-offset-2"
                      : "border-border-strong"
                  }`}
                  style={{ backgroundColor: p.value }}
                />
              ))}
              <label
                title="لون مخصص"
                className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong text-ink-faint hover:text-ink"
              >
                <Icon name="plus" size={14} />
                <input
                  type="color"
                  value={settings.background}
                  onChange={(e) =>
                    onChange({ ...settings, background: e.target.value })
                  }
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
            {isDarkColor(settings.background) && (
              <p className="mt-2 text-xs text-ink-faint">
                خلفية داكنة: القلم اتحوّل للأبيض تلقائيًا.
              </p>
            )}
          </section>

          <section className={disabled ? "pointer-events-none opacity-40" : ""}>
            <h3 className="mb-2 text-xs font-medium text-ink-soft">الشبكة</h3>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-paper p-1">
              {GRID_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => onChange({ ...settings, grid: g.value })}
                  className={`rounded-lg py-1.5 text-xs transition ${
                    settings.grid === g.value
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              {settings.grid === "auto"
                ? "نقاط خفيفة وهي فاضية، وتختفي أول ما تبدأ الرسم."
                : settings.grid === "none"
                  ? "لوحة نضيفة بدون أي شبكة."
                  : "الشبكة بتفضل ظاهرة وبتظهر في الفيديو والتصدير كمان."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
