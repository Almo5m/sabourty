"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, IconName } from "@/features/shared/icons/Icon";
import { DiagramController, InspectorModel } from "../../objects/controller";
import { DashStyle } from "../../objects/connector";
import { HeadKind, RouteKind } from "../../objects/connectorRouting";
import { NOTE_COLORS, NOTE_LOOKS, NodeLook, darken } from "../../objects/nodeLooks";
import { NODE_SHAPES, NodeShape } from "../../objects/nodeShapes";
import { getFontInfo } from "../../lib/fonts";
import { SYSTEM_FONT } from "../../lib/fonts";
import { NotePreview } from "../NotePreview";
import { ColorDot, ColorGrid } from "./ColorField";
import { FontPicker } from "./FontPicker";

type Panel =
  | "shape"
  | "look"
  | "fill"
  | "stroke"
  | "font"
  | "textColor"
  | "heads"
  | null;

const SHAPE_ICON: Record<NodeShape, IconName> = {
  rect: "rectangle",
  rounded: "rounded",
  pill: "pill",
  ellipse: "circle",
  diamond: "diamond",
  triangle: "triangle",
  hexagon: "hexagon",
  parallelogram: "parallelogram",
  star: "star",
};

const ROUTES: { id: RouteKind; label: string; icon: IconName }[] = [
  { id: "straight", label: "مستقيم", icon: "line" },
  { id: "elbow", label: "متعرّج", icon: "elbow" },
  { id: "curve", label: "منحني", icon: "curve" },
];

const HEADS: { id: HeadKind; label: string }[] = [
  { id: "none", label: "بدون" },
  { id: "arrow", label: "سهم مفتوح" },
  { id: "triangle", label: "سهم مصمت" },
  { id: "dot", label: "نقطة" },
  { id: "diamond", label: "معيّن" },
  { id: "bar", label: "شرطة" },
];

const DASHES: { id: DashStyle; label: string; pattern: string }[] = [
  { id: "solid", label: "متصل", pattern: "" },
  { id: "dashed", label: "متقطع", pattern: "6 4" },
  { id: "dotted", label: "منقّط", pattern: "1 5" },
];

/** رسم صغير لرأس السهم (على الطرف الأيمن من خط قصير). */
function HeadGlyph({ kind, flip }: { kind: HeadKind; flip?: boolean }) {
  return (
    <svg width="42" height="18" viewBox="0 0 42 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: flip ? "scaleX(-1)" : undefined }}>
      <path d="M3 9h28" />
      {kind === "arrow" && <path d="M28 3l9 6-9 6" />}
      {kind === "triangle" && <path d="M26 3l12 6-12 6z" fill="currentColor" />}
      {kind === "dot" && <circle cx="34" cy="9" r="4.5" fill="currentColor" />}
      {kind === "diamond" && <path d="M26 9l6-5 6 5-6 5z" fill="currentColor" />}
      {kind === "bar" && <path d="M36 3v12" />}
    </svg>
  );
}

function Btn({
  label,
  active,
  onClick,
  children,
  wide,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg text-ink-soft transition ${
        wide ? "min-w-9 px-2" : "w-9"
      } ${active ? "bg-accent-soft text-accent-strong" : "hover:bg-paper hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />;

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-ink-soft">
      <span className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full accent-accent"
      />
    </label>
  );
}

function DashRow({ value, onChange }: { value: DashStyle; onChange: (d: DashStyle) => void }) {
  return (
    <div className="flex gap-1.5">
      {DASHES.map((dash) => (
        <button
          key={dash.id}
          aria-label={dash.label}
          title={dash.label}
          onClick={() => onChange(dash.id)}
          className={`flex h-9 flex-1 items-center justify-center rounded-lg border transition ${
            value === dash.id ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-ink-soft hover:bg-paper"
          }`}
        >
          <svg width="44" height="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 3h38" strokeDasharray={dash.pattern} />
          </svg>
        </button>
      ))}
    </div>
  );
}

const cardClass = "pointer-events-auto rounded-2xl border border-border bg-surface p-3 shadow-panel-lg";

interface InspectorBarProps {
  diagram: DiagramController;
  model: InspectorModel;
}

/**
 * لوحة الخصائص العائمة: بتظهر جنب العنصر المختار (عقدة / رابط / نص) وبتتبعه لما
 * يتحرك أو يتكبّر. كل تعديل بيتطبّق على كل العناصر المختارة من نفس النوع.
 */
export function InspectorBar({ diagram, model }: InspectorBarProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (next: Panel) => setPanel((p) => (p === next ? null : next));

  // تتبّع موضع العنصر: بنحرّك الحاوية مباشرة (بدون state) عشان ما نعيد رسم React كل إطار
  useLayoutEffect(() => {
    const place = () => {
      const wrap = wrapRef.current;
      const rect = diagram.getAnchorRect();
      if (!wrap || !rect) return;
      const view = diagram.getViewSize();
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      const centerX = (rect.left + rect.right) / 2;
      const x = Math.min(Math.max(centerX - w / 2, 8), Math.max(view.width - w - 8, 8));
      // بتفضل تحت الأشرطة العلوية (y >= 84) وفوق متنقّل الصفحات والزوم
      const topSafe = 84;
      let y = rect.top - h - 16;
      if (y < topSafe) y = rect.bottom + 16;
      y = Math.min(y, view.height - h - 84);
      y = Math.max(y, topSafe);
      wrap.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    place();
    return diagram.onRender(place);
  }, [diagram, model, panel]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const node = model.node;
  const connector = model.connector;
  const text = model.text;
  const isNote = node ? node.look !== "plain" : false;
  const fontSource = node ?? text;

  const fontButton = fontSource && (
    <>
      <Btn label="نوع الخط" active={panel === "font"} onClick={() => toggle("font")} wide>
        <span
          className="max-w-[92px] truncate text-xs"
          style={{ fontFamily: getFontInfo(fontSource.fontFamily) ? `"${fontSource.fontFamily}", sans-serif` : undefined }}
        >
          {getFontInfo(fontSource.fontFamily)?.family ?? SYSTEM_FONT.label}
        </span>
        <Icon name="chevronDown" size={13} />
      </Btn>
      <div className="flex items-center">
        <Btn label="تصغير الخط" onClick={() => setFontSize(fontSource.fontSize - 2)}>
          <Icon name="minus" size={14} />
        </Btn>
        <span className="w-7 text-center text-xs tabular-nums text-ink-soft">{Math.round(fontSource.fontSize)}</span>
        <Btn label="تكبير الخط" onClick={() => setFontSize(fontSource.fontSize + 2)}>
          <Icon name="plus" size={14} />
        </Btn>
      </div>
      <Btn label="خط عريض" active={fontSource.fontWeight === "bold"} onClick={() => patchText({ fontWeight: fontSource.fontWeight === "bold" ? "normal" : "bold" })}>
        <span className="text-base font-bold leading-none">B</span>
      </Btn>
      <Btn label="خط مائل" active={fontSource.fontStyle === "italic"} onClick={() => patchText({ fontStyle: fontSource.fontStyle === "italic" ? "normal" : "italic" })}>
        <span className="text-base italic leading-none">I</span>
      </Btn>
      {(["right", "center", "left"] as const).map((align) => (
        <Btn
          key={align}
          label={align === "right" ? "محاذاة لليمين" : align === "center" ? "توسيط" : "محاذاة لليسار"}
          active={fontSource.textAlign === align}
          onClick={() => patchText({ textAlign: align })}
        >
          <Icon name={align === "right" ? "alignRight" : align === "center" ? "alignCenter" : "alignLeft"} size={17} />
        </Btn>
      ))}
    </>
  );

  function patchText(values: { fontWeight?: "normal" | "bold"; fontStyle?: "normal" | "italic"; textAlign?: "right" | "center" | "left"; fontFamily?: string; fontSize?: number }) {
    if (model.nodeCount) diagram.applyNodePatch(values);
    if (model.textCount) diagram.applyTextPatch(values);
  }

  function setFontSize(size: number) {
    patchText({ fontSize: Math.min(Math.max(size, 8), 200) });
  }

  const panelBody = (() => {
    if (panel === "font" && fontSource) {
      return <FontPicker value={fontSource.fontFamily} onPick={(family) => patchText({ fontFamily: family })} />;
    }
    if (panel === "textColor" && node) {
      return <ColorGrid value={node.textColor} onChange={(c) => diagram.applyNodePatch({ textColor: c })} />;
    }
    if (panel === "textColor" && text) {
      return <ColorGrid value={text.fill} onChange={(c) => diagram.applyTextPatch({ fill: c })} />;
    }
    if (node && panel === "shape") {
      return (
        <div className={`${cardClass} grid grid-cols-3 gap-1.5`}>
          {NODE_SHAPES.map((shape) => (
            <button
              key={shape.id}
              title={shape.label}
              aria-label={shape.label}
              onClick={() => diagram.applyNodePatch({ shape: shape.id })}
              className={`flex h-12 w-16 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] transition ${
                node.shape === shape.id ? "bg-accent-soft text-accent-strong ring-2 ring-accent/50" : "text-ink-soft hover:bg-paper"
              }`}
            >
              <Icon name={SHAPE_ICON[shape.id]} size={20} />
            </button>
          ))}
        </div>
      );
    }
    if (node && panel === "look") {
      const fill = node.fill || NOTE_COLORS[0].fill;
      const accent = node.stroke || NOTE_COLORS[0].accent;
      return (
        <div className={`${cardClass} grid grid-cols-3 gap-1.5`}>
          {([{ id: "plain" as NodeLook, label: "شكل عادي" }, ...NOTE_LOOKS]).map((look) => (
            <button
              key={look.id}
              aria-label={`مظهر ${look.label}`}
              onClick={() => {
                const patch: Parameters<typeof diagram.applyNodePatch>[0] = { look: look.id };
                // لو الشكل كان بدون لون، المظاهر محتاجة لون يبان
                if (look.id !== "plain" && !node.fill) {
                  patch.fill = NOTE_COLORS[0].fill;
                  patch.stroke = NOTE_COLORS[0].accent;
                }
                diagram.applyNodePatch(patch);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] text-ink-soft transition ${
                node.look === look.id ? "bg-accent-soft ring-2 ring-accent/50" : "hover:bg-paper"
              }`}
            >
              {look.id === "plain" ? (
                <div className="h-11 w-14 rounded-sm border-2 border-ink-soft" />
              ) : (
                <NotePreview look={look.id} fill={fill} accent={accent} />
              )}
              {look.label}
            </button>
          ))}
        </div>
      );
    }
    if (node && panel === "fill") {
      return (
        <ColorGrid
          value={node.fill}
          allowNone={!isNote}
          onChange={(color) => {
            // المظاهر بتاخد لون تمييز (إطار/شريط) مناسب للون المختار
            const note = NOTE_COLORS.find((c) => c.fill === color);
            if (!isNote) diagram.applyNodePatch({ fill: color });
            else diagram.applyNodePatch({ fill: color, stroke: note ? note.accent : darken(color, 0.35) });
          }}
        />
      );
    }
    if (node && panel === "stroke") {
      return (
        <div className={`${cardClass} w-[272px] space-y-3`}>
          <ColorGrid value={node.stroke} onChange={(c) => diagram.applyNodePatch({ stroke: c })} />
          <Slider label="سُمك الحد" value={node.strokeWidth} min={0} max={14} onChange={(v) => diagram.applyNodePatch({ strokeWidth: v })} />
          <DashRow value={node.dash} onChange={(d) => diagram.applyNodePatch({ dash: d })} />
          {(node.shape === "rect" || node.shape === "rounded") && (
            <Slider label="استدارة الزوايا" value={node.cornerRadius} min={0} max={60} onChange={(v) => diagram.applyNodePatch({ cornerRadius: v, shape: v > 0 ? "rounded" : "rect" })} />
          )}
          <Slider label="الشفافية" value={node.opacity} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}٪`} onChange={(v) => diagram.applyNodePatch({ opacity: v })} />
        </div>
      );
    }
    if (connector && panel === "stroke") {
      return (
        <div className={`${cardClass} w-[272px] space-y-3`}>
          <ColorGrid value={connector.stroke} onChange={(c) => diagram.applyConnectorPatch({ stroke: c })} />
          <Slider label="السُمك" value={connector.strokeWidth} min={1} max={14} onChange={(v) => diagram.applyConnectorPatch({ strokeWidth: v })} />
          <DashRow value={connector.dash} onChange={(d) => diagram.applyConnectorPatch({ dash: d })} />
          <Slider label="الشفافية" value={connector.opacity} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}٪`} onChange={(v) => diagram.applyConnectorPatch({ opacity: v })} />
        </div>
      );
    }
    if (connector && panel === "heads") {
      return (
        <div className={`${cardClass} w-[300px] space-y-2`}>
          {(["startHead", "endHead"] as const).map((which) => (
            <div key={which}>
              <p className="mb-1 text-xs text-ink-soft">{which === "startHead" ? "بداية الرابط" : "نهاية الرابط"}</p>
              <div className="grid grid-cols-3 gap-1">
                {HEADS.map((head) => (
                  <button
                    key={head.id}
                    aria-label={`${which === "startHead" ? "بداية" : "نهاية"}: ${head.label}`}
                    title={head.label}
                    onClick={() => diagram.applyConnectorPatch({ [which]: head.id })}
                    className={`flex h-9 items-center justify-center rounded-lg transition ${
                      connector[which] === head.id ? "bg-accent-soft text-accent-strong ring-2 ring-accent/50" : "text-ink-soft hover:bg-paper"
                    }`}
                  >
                    <HeadGlyph kind={head.id} flip={which === "startHead"} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  })();

  return (
    <div ref={wrapRef} className="pointer-events-none absolute left-0 top-0 z-30 flex flex-col items-center gap-2" style={{ width: "max-content", maxWidth: "min(96vw, 720px)" }}>
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-border bg-surface p-1 shadow-panel" role="toolbar" aria-label="خصائص العنصر">
        {node && (
          <>
            <Btn label="الشكل" active={panel === "shape"} onClick={() => toggle("shape")}>
              <Icon name={SHAPE_ICON[node.shape]} size={18} />
            </Btn>
            <Btn label="المظهر" active={panel === "look"} onClick={() => toggle("look")}>
              <Icon name="sticky" size={18} />
            </Btn>
            <Btn label="لون التعبئة" active={panel === "fill"} onClick={() => toggle("fill")}>
              <ColorDot color={node.fill} />
            </Btn>
            {!(node.look === "flat" || node.look === "sticky" || node.look === "tape") && (
              <Btn label="الحد والشفافية" active={panel === "stroke"} onClick={() => toggle("stroke")}>
                <Icon name="settings" size={17} />
              </Btn>
            )}
            <Sep />
          </>
        )}
        {connector && !node && (
          <>
            {ROUTES.map((route) => (
              <Btn key={route.id} label={`رابط ${route.label}`} active={connector.route === route.id} onClick={() => diagram.applyConnectorPatch({ route: route.id })}>
                <Icon name={route.icon} size={18} />
              </Btn>
            ))}
            <Sep />
            <Btn label="رؤوس الأسهم" active={panel === "heads"} onClick={() => toggle("heads")}>
              <Icon name="arrow" size={18} />
            </Btn>
            <Btn label="اللون والسُمك" active={panel === "stroke"} onClick={() => toggle("stroke")}>
              <ColorDot color={connector.stroke} />
            </Btn>
          </>
        )}
        {fontSource && (
          <>
            {fontButton}
            <Btn label="لون النص" active={panel === "textColor"} onClick={() => toggle("textColor")}>
              <ColorDot color={node ? node.textColor : text?.fill ?? ""} />
            </Btn>
            {node && (
              <>
                <Sep />
                {(["top", "middle", "bottom"] as const).map((v) => (
                  <Btn
                    key={v}
                    label={v === "top" ? "النص لأعلى" : v === "middle" ? "النص في المنتصف" : "النص لأسفل"}
                    active={node.verticalAlign === v}
                    onClick={() => diagram.applyNodePatch({ verticalAlign: v })}
                  >
                    <Icon name={v === "top" ? "vTop" : v === "middle" ? "vMiddle" : "vBottom"} size={17} />
                  </Btn>
                ))}
              </>
            )}
          </>
        )}
      </div>
      {panelBody && <div className="pointer-events-auto">{panelBody}</div>}
    </div>
  );
}
