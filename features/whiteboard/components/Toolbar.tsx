"use client";

import { useEffect, useState } from "react";
import { Icon, IconName } from "@/features/shared/icons/Icon";
import { colorWithAlpha } from "../lib/color";
import { NoteStyle } from "../objects/controller";
import { NotePreview } from "./NotePreview";
import { NOTE_COLORS, NOTE_LOOKS } from "../objects/nodeLooks";
import {
  HIGHLIGHT_PALETTE,
  INK_PALETTE,
  TOOLS_WITH_PROPERTIES,
  ToolSettings,
  ToolType,
} from "../types";

interface ToolButtonDef {
  tool: ToolType;
  label: string;
  icon: IconName;
}

const NAVIGATE_TOOLS: ToolButtonDef[] = [
  { tool: "select", label: "تحديد", icon: "select" },
  { tool: "hand", label: "تحريك اللوحة", icon: "hand" },
];

const DRAW_TOOLS: ToolButtonDef[] = [
  { tool: "pen", label: "قلم حر", icon: "pen" },
  { tool: "highlighter", label: "هايلايتر", icon: "highlighter" },
  { tool: "spray", label: "فرشاة رش", icon: "spray" },
  { tool: "eraser", label: "ممحاة", icon: "eraser" },
];

const INSERT_TOOLS: ToolButtonDef[] = [
  { tool: "text", label: "نص", icon: "text" },
  { tool: "voice", label: "ملاحظة صوتية", icon: "voice" },
];

const SHAPE_TOOLS: ToolButtonDef[] = [
  { tool: "rectangle", label: "مستطيل", icon: "rectangle" },
  { tool: "rounded", label: "مستطيل مدوّر", icon: "rounded" },
  { tool: "pill", label: "كبسولة", icon: "pill" },
  { tool: "circle", label: "دائرة", icon: "circle" },
  { tool: "diamond", label: "معيّن", icon: "diamond" },
  { tool: "triangle", label: "مثلث", icon: "triangle" },
  { tool: "hexagon", label: "سداسي", icon: "hexagon" },
  { tool: "parallelogram", label: "متوازي أضلاع", icon: "parallelogram" },
  { tool: "star", label: "نجمة", icon: "star" },
];

const CONNECTOR_TOOLS: ToolButtonDef[] = [
  { tool: "line", label: "خط", icon: "line" },
  { tool: "arrow", label: "سهم", icon: "arrow" },
  { tool: "elbow", label: "سهم متعرّج", icon: "elbow" },
  { tool: "curve", label: "سهم منحني", icon: "curve" },
];

type Popover = "shapes" | "notes" | "style" | null;

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
  noteStyle: NoteStyle;
  onNoteStyleChange: (style: NoteStyle) => void;
  onOpenVoiceNotes: () => void;
  onOpenTemplates: () => void;
  onOpenVideoExport: () => void;
  onToggleLayers: () => void;
  layersOpen: boolean;
  onToggleSettings: () => void;
  settingsOpen: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
}

function IconButton({
  icon,
  label,
  active,
  tone = "tool",
  onClick,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  /** tool = أداة مختارة (أخضر ممتلئ)، toggle = لوحة مفتوحة (أخضر فاتح) */
  tone?: "tool" | "toggle";
  onClick: () => void;
}) {
  const activeClass =
    tone === "tool"
      ? "bg-accent text-white shadow-sm"
      : "bg-accent-soft text-accent-strong";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
        active ? activeClass : "text-ink-soft hover:bg-paper hover:text-ink"
      }`}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-border" />;
}

const CHECKER =
  "repeating-conic-gradient(#d8d1bd 0% 25%, #ffffff 0% 50%) 0 0 / 10px 10px";

function StylePanel({
  tool,
  settings,
  onChange,
}: {
  tool: ToolType;
  settings: ToolSettings;
  onChange: (settings: ToolSettings) => void;
}) {
  const palette = tool === "highlighter" ? HIGHLIGHT_PALETTE : INK_PALETTE;
  const isCustom = !palette.some(
    (swatch) => swatch.value.toLowerCase() === settings.color.toLowerCase()
  );
  const previewWidth = Math.min(
    tool === "highlighter" ? Math.max(14, settings.size * 2) : settings.size,
    26
  );

  return (
    <div className="w-[300px] max-w-full space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-panel-lg">
      <div className="flex flex-wrap gap-2">
        {palette.map((swatch) => {
          const selected =
            swatch.value.toLowerCase() === settings.color.toLowerCase();
          const light = swatch.value === "#ffffff" || tool === "highlighter";
          return (
            <button
              key={swatch.value}
              title={swatch.label}
              aria-label={swatch.label}
              onClick={() => onChange({ ...settings, color: swatch.value })}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                selected
                  ? "scale-110 border-ink ring-2 ring-accent/40"
                  : "border-border-strong hover:scale-105"
              }`}
              style={{ backgroundColor: swatch.value }}
            >
              {selected && (
                <Icon
                  name="check"
                  size={15}
                  className={light ? "text-ink" : "text-white"}
                />
              )}
            </button>
          );
        })}
        <label
          title="لون مخصص"
          className={`relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border ${
            isCustom ? "border-ink ring-2 ring-accent/40" : "border-border-strong"
          }`}
          style={{
            background: isCustom
              ? settings.color
              : "conic-gradient(#c8432f, #e8b229, #7d9a2e, #1b8aa0, #5a4fcf, #d1427f, #c8432f)",
          }}
        >
          <input
            type="color"
            aria-label="لون مخصص"
            value={settings.color}
            onChange={(e) => onChange({ ...settings, color: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>

      <div
        className="flex h-10 items-center justify-center overflow-hidden rounded-xl border border-border"
        style={{ background: CHECKER }}
        aria-hidden="true"
      >
        <span
          className="block w-4/5"
          style={{
            height: previewWidth,
            borderRadius: tool === "highlighter" ? 2 : previewWidth,
            backgroundColor: colorWithAlpha(settings.color, settings.opacity),
          }}
        />
      </div>

      <label className="block text-xs text-ink-soft">
        <span className="mb-1 flex justify-between">
          <span>الحجم</span>
          <span className="tabular-nums">{settings.size}</span>
        </span>
        <input
          type="range"
          min={1}
          max={40}
          value={settings.size}
          onChange={(e) =>
            onChange({ ...settings, size: Number(e.target.value) })
          }
          className="h-6 w-full accent-accent"
        />
      </label>

      <label className="block text-xs text-ink-soft">
        <span className="mb-1 flex justify-between">
          <span>الشفافية</span>
          <span className="tabular-nums">
            {Math.round(settings.opacity * 100)}٪
          </span>
        </span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={settings.opacity}
          onChange={(e) =>
            onChange({ ...settings, opacity: Number(e.target.value) })
          }
          className="h-6 w-full accent-accent"
        />
      </label>
    </div>
  );
}

function NotePanel({
  style,
  onChange,
}: {
  style: NoteStyle;
  onChange: (style: NoteStyle) => void;
}) {
  return (
    <div className="w-[300px] max-w-full space-y-3 rounded-2xl border border-border bg-surface p-3 shadow-panel-lg">
      <div className="grid grid-cols-5 gap-1.5">
        {NOTE_LOOKS.map((look) => (
          <button
            key={look.id}
            onClick={() => onChange({ ...style, look: look.id })}
            aria-label={`ملاحظة ${look.label}`}
            title={look.label}
            className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] text-ink-soft transition ${
              style.look === look.id ? "bg-accent-soft ring-2 ring-accent/50" : "hover:bg-paper"
            }`}
          >
            <NotePreview look={look.id} fill={style.fill} accent={style.accent} />
            {look.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {NOTE_COLORS.map((color) => (
          <button
            key={color.fill}
            title={color.label}
            aria-label={`لون ${color.label}`}
            onClick={() => onChange({ ...style, fill: color.fill, accent: color.accent })}
            className={`h-8 w-8 rounded-full border transition ${
              style.fill === color.fill ? "scale-110 border-ink ring-2 ring-accent/40" : "border-border-strong hover:scale-105"
            }`}
            style={{ background: color.fill }}
          />
        ))}
      </div>
    </div>
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
  noteStyle,
  onNoteStyleChange,
  onOpenVoiceNotes,
  onOpenTemplates,
  onOpenVideoExport,
  onToggleLayers,
  layersOpen,
  onToggleSettings,
  settingsOpen,
  canGroup,
  canUngroup,
  onGroup,
  onUngroup,
}: ToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [popover, setPopover] = useState<Popover>(null);

  useEffect(() => {
    if (!popover && !moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopover(null);
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover, moreOpen]);

  // أي ضغطة برّه الأشرطة والقوائم بتقفل القوائم المنبثقة، ومن غير ما نبلع الضغطة
  // (فالضغطة نفسها بتوصل للكانفا وتبدأ الرسم)
  useEffect(() => {
    if (!popover && !moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest("[data-toolbar-surface]")) {
        setPopover(null);
        setMoreOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [popover, moreOpen]);

  const hasProperties = TOOLS_WITH_PROPERTIES.includes(activeTool);
  const activeShape = [...SHAPE_TOOLS, ...CONNECTOR_TOOLS].find((t) => t.tool === activeTool);
  const showSelectionActions =
    activeTool === "select" && (canGroup || canUngroup);

  const pickTool = (tool: ToolType) => {
    setPopover(null);
    onToolChange(tool);
  };

  const renderTools = (tools: ToolButtonDef[]) =>
    tools.map((t) => (
      <IconButton
        key={t.tool}
        icon={t.icon}
        label={t.label}
        active={activeTool === t.tool}
        onClick={() => pickTool(t.tool)}
      />
    ));

  return (
    <>
      {/* الشريط الرئيسي للأدوات */}
      <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-3">
        <div data-toolbar-surface className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-border bg-surface px-1.5 py-1.5 shadow-panel">
          {renderTools(NAVIGATE_TOOLS)}
          <Divider />
          {renderTools(DRAW_TOOLS)}
          <Divider />
          {renderTools(INSERT_TOOLS.slice(0, 1))}
          <IconButton
            icon="sticky"
            label="ملاحظة"
            active={activeTool === "sticky" || popover === "notes"}
            onClick={() => {
              onToolChange("sticky");
              setPopover((p) => (p === "notes" ? null : "notes"));
            }}
          />
          {renderTools(INSERT_TOOLS.slice(1))}
          <Divider />
          <IconButton
            icon={activeShape?.icon ?? "shapes"}
            label="الأشكال"
            active={Boolean(activeShape) || popover === "shapes"}
            onClick={() => setPopover((p) => (p === "shapes" ? null : "shapes"))}
          />
          <Divider />
          <button
            onClick={() => setPopover((p) => (p === "style" ? null : "style"))}
            disabled={!hasProperties}
            title="اللون والحجم والشفافية"
            aria-label="اللون والحجم والشفافية"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-30 ${
              popover === "style" ? "bg-accent-soft" : "hover:bg-paper"
            }`}
          >
            <span
              className="block h-6 w-6 rounded-full border border-border-strong"
              style={{
                backgroundColor: hasProperties
                  ? colorWithAlpha(settings.color, Math.max(settings.opacity, 0.35))
                  : "transparent",
              }}
            />
          </button>
          <Divider />
          <IconButton icon="undo" label="تراجع" onClick={onUndo} />
          <IconButton icon="redo" label="إعادة" onClick={onRedo} />
        </div>
      </div>

      {/* قائمة الأشكال */}
      {popover === "shapes" && (
        <div className="pointer-events-none absolute inset-x-0 top-[72px] z-40 flex justify-center px-3">
          <div data-toolbar-surface className="pointer-events-auto space-y-1 rounded-2xl border border-border bg-surface p-1.5 shadow-panel-lg">
            <div className="grid grid-cols-5 gap-1">{renderTools(SHAPE_TOOLS)}</div>
            <div className="mx-1 h-px bg-border" />
            <div className="grid grid-cols-5 gap-1">{renderTools(CONNECTOR_TOOLS)}</div>
          </div>
        </div>
      )}

      {popover === "notes" && (
        <div className="pointer-events-none absolute inset-x-0 top-[72px] z-40 flex justify-center px-3">
          <div data-toolbar-surface className="pointer-events-auto">
            <NotePanel style={noteStyle} onChange={onNoteStyleChange} />
          </div>
        </div>
      )}

      {/* اللون / الحجم / الشفافية */}
      {popover === "style" && hasProperties && (
        <div className="pointer-events-none absolute inset-x-0 top-[72px] z-40 flex justify-center px-3">
          <div data-toolbar-surface className="pointer-events-auto">
            <StylePanel
              tool={activeTool}
              settings={settings}
              onChange={onSettingsChange}
            />
          </div>
        </div>
      )}

      {/* إجراءات التحديد المتعدد (تجميع / فك تجميع) */}
      {showSelectionActions && (
        <div className="pointer-events-none absolute inset-x-0 top-[72px] z-20 flex justify-center px-3">
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
      <div data-toolbar-surface className="pointer-events-none absolute end-4 top-[68px] z-20 flex items-start gap-2 xl:top-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-surface p-1.5 shadow-panel">
          <IconButton
            icon="layers"
            label="الطبقات"
            tone="toggle"
            active={layersOpen}
            onClick={onToggleLayers}
          />
          <IconButton
            icon="settings"
            label="إعدادات اللوحة"
            tone="toggle"
            active={settingsOpen}
            onClick={onToggleSettings}
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
