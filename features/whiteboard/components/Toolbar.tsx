"use client";

import { useState } from "react";
import { Icon, IconName } from "@/features/shared/icons/Icon";
import { PRESET_COLORS, ToolSettings, ToolType } from "../types";

interface ToolButtonDef {
  tool: ToolType;
  label: string;
  icon: IconName;
}

const DRAW_TOOLS: ToolButtonDef[] = [
  { tool: "select", label: "تحديد", icon: "select" },
  { tool: "pen", label: "قلم حر", icon: "pen" },
  { tool: "spray", label: "فرشاة رش", icon: "spray" },
  { tool: "highlighter", label: "تظليل", icon: "highlighter" },
  { tool: "eraser", label: "ممحاة", icon: "eraser" },
  { tool: "text", label: "نص", icon: "text" },
  { tool: "sticky", label: "ملاحظة لاصقة", icon: "sticky" },
  { tool: "voice", label: "ملاحظة صوتية", icon: "voice" },
];

const SHAPE_TOOLS: ToolButtonDef[] = [
  { tool: "rectangle", label: "مستطيل", icon: "rectangle" },
  { tool: "circle", label: "دائرة", icon: "circle" },
  { tool: "triangle", label: "مثلث", icon: "triangle" },
  { tool: "line", label: "خط", icon: "line" },
  { tool: "arrow", label: "سهم", icon: "arrow" },
  { tool: "star", label: "نجمة", icon: "star" },
];

const COLOR_TOOLS: ToolType[] = [
  "pen",
  "spray",
  "highlighter",
  "text",
  "sticky",
  "rectangle",
  "circle",
  "triangle",
  "line",
  "arrow",
  "star",
];

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  settings: ToolSettings;
  onSettingsChange: (settings: ToolSettings) => void;
  onUndo: () => void;
  onRedo: () => void;
  onImportImage: () => void;
  onImportPDF: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  isPdfMode: boolean;
  onOpenVoiceNotes: () => void;
  onOpenTemplates: () => void;
  onOpenVideoExport: () => void;
  onToggleLayers: () => void;
  layersOpen: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
}

function IconButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
        active
          ? "bg-accent-soft text-accent-strong"
          : "text-ink-soft hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Toolbar({
  activeTool,
  onToolChange,
  settings,
  onSettingsChange,
  onUndo,
  onRedo,
  onImportImage,
  onImportPDF,
  onExportPNG,
  onExportPDF,
  isPdfMode,
  onOpenVoiceNotes,
  onOpenTemplates,
  onOpenVideoExport,
  onToggleLayers,
  layersOpen,
  canGroup,
  canUngroup,
  onGroup,
  onUngroup,
}: ToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const showProperties = COLOR_TOOLS.includes(activeTool);
  const showSelectionActions =
    activeTool === "select" && (canGroup || canUngroup);

  return (
    <>
      {/* الشريط الرئيسي للأدوات */}
      <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-panel">
          {DRAW_TOOLS.map((t) => (
            <IconButton
              key={t.tool}
              icon={t.icon}
              label={t.label}
              active={activeTool === t.tool}
              onClick={() => onToolChange(t.tool)}
            />
          ))}
          <div className="mx-1 h-6 w-px shrink-0 bg-border" />
          {SHAPE_TOOLS.map((t) => (
            <IconButton
              key={t.tool}
              icon={t.icon}
              label={t.label}
              active={activeTool === t.tool}
              onClick={() => onToolChange(t.tool)}
            />
          ))}
          <div className="mx-1 h-6 w-px shrink-0 bg-border" />
          <IconButton icon="undo" label="تراجع" onClick={onUndo} />
          <IconButton icon="redo" label="إعادة" onClick={onRedo} />
        </div>
      </div>

      {/* لوحة الخصائص السياقية (لون / حجم / شفافية) */}
      {showProperties && (
        <div className="pointer-events-none absolute inset-x-0 top-[70px] z-20 flex justify-center px-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-panel">
            <div className="flex items-center gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onSettingsChange({ ...settings, color })}
                  className={`h-5 w-5 rounded-full border transition ${
                    settings.color === color
                      ? "ring-2 ring-offset-1 ring-ink"
                      : "border-border-strong"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={settings.color}
                onChange={(e) =>
                  onSettingsChange({ ...settings, color: e.target.value })
                }
                className="h-5 w-5 cursor-pointer rounded-full border border-border-strong bg-transparent"
              />
            </div>

            <div className="h-5 w-px bg-border" />

            <div className="flex items-center gap-2 text-xs text-ink-soft">
              <span>الحجم</span>
              <input
                type="range"
                min={1}
                max={40}
                value={settings.size}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    size: Number(e.target.value),
                  })
                }
                className="w-20 accent-accent"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-ink-soft">
              <span>الشفافية</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={settings.opacity}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    opacity: Number(e.target.value),
                  })
                }
                className="w-20 accent-accent"
              />
            </div>
          </div>
        </div>
      )}

      {/* إجراءات التحديد المتعدد (تجميع / فك تجميع) */}
      {showSelectionActions && (
        <div className="pointer-events-none absolute inset-x-0 top-[70px] z-20 flex justify-center px-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-panel">
            {canGroup && (
              <button
                onClick={onGroup}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-soft hover:bg-paper hover:text-ink"
              >
                <Icon name="group" size={15} />
                تجميع
              </button>
            )}
            {canUngroup && (
              <button
                onClick={onUngroup}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-soft hover:bg-paper hover:text-ink"
              >
                <Icon name="ungroup" size={15} />
                فك التجميع
              </button>
            )}
          </div>
        </div>
      )}

      {/* عنقود الإجراءات الثانوية */}
      <div className="pointer-events-none absolute end-4 top-4 z-20 flex items-start gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-surface p-1.5 shadow-panel">
          <IconButton
            icon="layers"
            label="الطبقات"
            active={layersOpen}
            onClick={onToggleLayers}
          />
          <IconButton
            icon="templates"
            label="القوالب"
            onClick={onOpenTemplates}
          />
          <IconButton
            icon="voiceList"
            label="الملاحظات الصوتية"
            onClick={onOpenVoiceNotes}
          />
          <IconButton
            icon="video"
            label="تصدير فيديو"
            onClick={onOpenVideoExport}
          />

          <div className="relative">
            <IconButton
              icon="more"
              label="المزيد"
              active={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            />
            {moreOpen && (
              <div className="absolute end-0 top-11 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 text-sm shadow-panel-lg">
                <button
                  onClick={() => {
                    onImportImage();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-ink-soft hover:bg-accent-soft hover:text-ink"
                >
                  <Icon name="image" size={16} />
                  استيراد صورة
                </button>
                <button
                  onClick={() => {
                    onImportPDF();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-ink-soft hover:bg-accent-soft hover:text-ink"
                >
                  <Icon name="pdf" size={16} />
                  استيراد PDF
                </button>
                <button
                  onClick={() => {
                    onExportPNG();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-ink-soft hover:bg-accent-soft hover:text-ink"
                >
                  <Icon name="png" size={16} />
                  تصدير PNG
                </button>
                {isPdfMode && (
                  <button
                    onClick={() => {
                      onExportPDF();
                      setMoreOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-ink-soft hover:bg-accent-soft hover:text-ink"
                  >
                    <Icon name="pdf" size={16} />
                    تصدير PDF
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
