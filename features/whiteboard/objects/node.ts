import * as fabric from "fabric";
import { nodeBridge } from "./bridge";
import { Pt, Side, SIDE_NORMAL, SIDES, add } from "./geometry";
import {
  ELEVATION_SHADOW,
  ElevationLevel,
  LOOK_ELEVATION,
  NODE_INK,
  NodeLook,
  contrastText,
  darken,
  isTransparentColor,
  withAlpha,
} from "./nodeLooks";
import { NodeShape, sideAnchor, textArea, traceShape } from "./nodeShapes";

export type TextAlign = "right" | "center" | "left";
export type VerticalAlign = "top" | "middle" | "bottom";

export const DEFAULT_FONT_FAMILY =
  '"Segoe UI", Tahoma, "Geeza Pro", Arial, sans-serif';

/** خصائص العقدة الخاصة (بتتخزّن في JSON اللوحة). */
const NODE_PROPS = [
  "shape",
  "look",
  "label",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textAlign",
  "verticalAlign",
  "textColor",
  "lineHeight",
  "textPadding",
  "cornerRadius",
  "elevation",
] as const;

export interface NodeProps {
  shape: NodeShape;
  look: NodeLook;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  /** فاضي = لون تلقائي حسب التباين مع الخلفية */
  textColor: string;
  lineHeight: number;
  /** هامش النص الداخلي بالبكسل */
  textPadding: number;
  cornerRadius: number;
  /** -1 = حسب المظهر */
  elevation: number;
}

export const MIN_NODE_WIDTH = 24;
export const MIN_NODE_HEIGHT = 24;

export function detectDirection(text: string): "rtl" | "ltr" {
  // أول حرف "قوي" هو اللي بيحدد الاتجاه (نفس قاعدة المتصفح dir="auto")
  const strong = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]|[A-Za-z\u00C0-\u024F]/.exec(
    text
  );
  if (!strong) return "rtl";
  return /[A-Za-z\u00C0-\u024F]/.test(strong[0]) ? "ltr" : "rtl";
}

type ControlHandler = fabric.TransformActionHandler;

function createNodeControls(): Record<string, fabric.Control> {
  const utils = fabric.controlsUtils;
  const resizeBoth: ControlHandler = utils.wrapWithFireEvent(
    "resizing",
    utils.wrapWithFixedAnchor((event, transform, x, y) => {
      const widthChanged = utils.changeObjectWidth(event, transform, x, y);
      const heightChanged = utils.changeObjectHeight(event, transform, x, y);
      return widthChanged || heightChanged;
    })
  );

  const corner = (x: number, y: number) =>
    new fabric.Control({
      x,
      y,
      actionHandler: resizeBoth,
      cursorStyleHandler: utils.scaleCursorStyleHandler,
      actionName: "resizing",
    });

  const controls: Record<string, fabric.Control> = {
    tl: corner(-0.5, -0.5),
    tr: corner(0.5, -0.5),
    bl: corner(-0.5, 0.5),
    br: corner(0.5, 0.5),
    ml: new fabric.Control({
      x: -0.5,
      y: 0,
      actionHandler: utils.changeWidth,
      cursorStyleHandler: utils.scaleSkewCursorStyleHandler,
      actionName: "resizing",
    }),
    mr: new fabric.Control({
      x: 0.5,
      y: 0,
      actionHandler: utils.changeWidth,
      cursorStyleHandler: utils.scaleSkewCursorStyleHandler,
      actionName: "resizing",
    }),
    mt: new fabric.Control({
      x: 0,
      y: -0.5,
      actionHandler: utils.changeHeight,
      cursorStyleHandler: utils.scaleSkewCursorStyleHandler,
      actionName: "resizing",
    }),
    mb: new fabric.Control({
      x: 0,
      y: 0.5,
      actionHandler: utils.changeHeight,
      cursorStyleHandler: utils.scaleSkewCursorStyleHandler,
      actionName: "resizing",
    }),
    mtr: new fabric.Control({
      x: 0,
      y: -0.5,
      actionHandler: utils.rotationWithSnapping,
      cursorStyleHandler: utils.rotationStyleHandler,
      offsetY: -58,
      withConnection: true,
      actionName: "rotate",
    }),
  };

  // نقاط الربط الأربعة: سحب منها بيرسم رابط، ونقرة بتفتح عقدة فرعية جديدة
  const dotOffset = 24;
  const dots: [Side, number, number, number, number][] = [
    ["top", 0, -0.5, 0, -dotOffset],
    ["right", 0.5, 0, dotOffset, 0],
    ["bottom", 0, 0.5, 0, dotOffset],
    ["left", -0.5, 0, -dotOffset, 0],
  ];
  for (const [side, x, y, offsetX, offsetY] of dots) {
    controls[`connect-${side}`] = new fabric.Control({
      x,
      y,
      offsetX,
      offsetY,
      sizeX: 28,
      sizeY: 28,
      touchSizeX: 36,
      touchSizeY: 36,
      cursorStyleHandler: () => "crosshair",
      actionName: "connect",
      actionHandler: (_event, transform, px, py) => {
        nodeBridge.handlers?.move(transform.target as NodeObject, side, px, py);
        return false;
      },
      mouseDownHandler: (event, transform) => {
        nodeBridge.handlers?.start(
          transform.target as NodeObject,
          side,
          event as Event
        );
        return true;
      },
      mouseUpHandler: (_event, transform) => {
        nodeBridge.handlers?.end(transform.target as NodeObject, side);
        return true;
      },
      render: (ctx, left, top) => {
        ctx.save();
        ctx.translate(left, top);
        ctx.fillStyle = "#1f6f63";
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(4, 0);
        ctx.moveTo(0, -4);
        ctx.lineTo(0, 4);
        ctx.stroke();
        ctx.restore();
      },
    });
  }
  return controls;
}

/**
 * عقدة = شكل + نص مربوط بيه ككائن واحد. بتغطّي: الأشكال، الملاحظات بكل مظاهرها،
 * وعقد الخرائط الذهنية. النص بيتكتب عن طريق محرّر فوق الكانفا (NodeTextEditor)،
 * وبيتحرك ويتكبّر ويتحذف مع العقدة تلقائيًا.
 */
export class NodeObject extends fabric.FabricObject {
  static type = "FlowNode";

  static nodeDefaults: NodeProps = {
    shape: "rect",
    look: "plain",
    label: "",
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 18,
    fontWeight: "normal",
    fontStyle: "normal",
    textAlign: "center",
    verticalAlign: "middle",
    textColor: "",
    lineHeight: 1.3,
    textPadding: 12,
    cornerRadius: 10,
    elevation: -1,
  };

  static getDefaults(): Record<string, unknown> {
    return { ...super.getDefaults(), ...NodeObject.nodeDefaults };
  }

  static createControls(): { controls: Record<string, fabric.Control> } {
    return { controls: createNodeControls() };
  }

  declare shape: NodeShape;
  declare look: NodeLook;
  declare label: string;
  declare fontFamily: string;
  declare fontSize: number;
  declare fontWeight: "normal" | "bold";
  declare fontStyle: "normal" | "italic";
  declare textAlign: TextAlign;
  declare verticalAlign: VerticalAlign;
  declare textColor: string;
  declare lineHeight: number;
  declare textPadding: number;
  declare cornerRadius: number;
  declare elevation: number;

  /** بيتحوّل لـ true أثناء التحرير عشان العقدة ما ترسمش النص (المحرّر بيرسمه) */
  editing = false;

  private measurer: fabric.Textbox | null = null;
  private measurerKey = "";

  constructor(options?: Partial<NodeProps> & Record<string, unknown>) {
    super();
    Object.assign(this, NodeObject.nodeDefaults);
    this.setOptions(options as never);
    // الرسم بيتم مباشرة (بدون كاش) عشان الظل ما يتقصّش عند حدود الكائن
    this.objectCaching = false;
    this.strokeUniform = true;
    this.fitToText();
  }

  toObject(propertiesToInclude: string[] = []) {
    return super.toObject([...NODE_PROPS, ...propertiesToInclude] as never);
  }

  // ─────────── الألوان والمظهر ───────────

  get effectiveElevation(): ElevationLevel {
    if (this.elevation >= 0) return Math.min(2, this.elevation) as ElevationLevel;
    return LOOK_ELEVATION[this.look];
  }

  get resolvedTextColor(): string {
    if (this.textColor) return this.textColor;
    const fill = (this.fill as string) || "";
    switch (this.look) {
      case "flat":
        return contrastText(fill);
      case "outline":
      case "sticky":
      case "card":
      case "tape":
        return NODE_INK;
      default:
        if (isTransparentColor(fill)) {
          return typeof this.stroke === "string" ? this.stroke : NODE_INK;
        }
        return contrastText(fill);
    }
  }

  // ─────────── النص ───────────

  /** مساحة محجوزة أعلى النص لزخرفة المظهر (شريط البطاقة / الشريط اللاصق). */
  private reservedTop(): number {
    if (this.look === "card") return 8;
    if (this.look === "tape") return 16;
    return 0;
  }

  /** منطقة النص الداخلية بالإحداثيات المحلية (من مركز العقدة). */
  getTextRect() {
    const area = textArea(this.shape);
    const w = this.width;
    const h = this.height;
    const pad = this.textPadding;
    // شريط التمييز العلوي في البطاقة بياخد مساحة من النص
    const top = this.reservedTop();
    return {
      x: -w / 2 + area.x * w + pad,
      y: -h / 2 + area.y * h + pad + top,
      w: Math.max(area.w * w - pad * 2, 10),
      h: Math.max(area.h * h - pad * 2 - top, 10),
    };
  }

  private syncMeasurer(innerWidth: number): fabric.Textbox {
    if (!this.measurer) {
      this.measurer = new fabric.Textbox("", { objectCaching: false });
    }
    const key = [
      this.label,
      this.fontFamily,
      this.fontSize,
      this.fontWeight,
      this.fontStyle,
      this.textAlign,
      this.lineHeight,
      this.resolvedTextColor,
      Math.round(innerWidth),
    ].join("|");
    if (key !== this.measurerKey) {
      this.measurer.set({
        text: this.label,
        width: Math.round(innerWidth),
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
        textAlign: this.textAlign,
        lineHeight: this.lineHeight,
        fill: this.resolvedTextColor,
        direction: detectDirection(this.label),
      });
      this.measurerKey = key;
    }
    return this.measurer;
  }

  /** ارتفاع النص الفعلي لو اتكتب في المنطقة الحالية. */
  measureTextHeight(): number {
    if (!this.label) return 0;
    return this.syncMeasurer(this.getTextRect().w).height;
  }

  /** بيكبّر العقدة (مش بيصغّرها) لو النص أطول من المساحة المتاحة. */
  fitToText() {
    this.width = Math.max(this.width, MIN_NODE_WIDTH);
    this.height = Math.max(this.height, MIN_NODE_HEIGHT);
    if (!this.label) return;
    const area = textArea(this.shape);
    const reserved = this.textPadding * 2 + this.reservedTop();
    const needed = (this.measureTextHeight() + reserved) / area.h;
    if (needed > this.height) this.height = Math.ceil(needed);
  }

  /** يطبّق تعديلات على العقدة ويحدّث أبعادها وإحداثياتها. */
  patch(values: Partial<NodeProps> & Record<string, unknown>) {
    this.set(values as never);
    this.fitToText();
    this.dirty = true;
    this.setCoords();
  }

  // ─────────── نقاط الربط ───────────

  /** نقطة الربط على ضلع معيّن، بإحداثيات اللوحة (بتراعي الدوران والتجميع). */
  getAnchor(side: Side): { point: Pt; normal: Pt } {
    const local = sideAnchor(this.shape, side, this.width, this.height);
    const matrix = this.calcTransformMatrix();
    const point = fabric.util.transformPoint(
      new fabric.Point(local.x, local.y),
      matrix
    );
    const origin = fabric.util.transformPoint(new fabric.Point(0, 0), matrix);
    const normal = SIDE_NORMAL[side];
    const tip = fabric.util.transformPoint(
      new fabric.Point(local.x + normal.x * 100, local.y + normal.y * 100),
      matrix
    );
    const length = Math.hypot(tip.x - point.x, tip.y - point.y) || 1;
    void origin;
    return {
      point: { x: point.x, y: point.y },
      normal: { x: (tip.x - point.x) / length, y: (tip.y - point.y) / length },
    };
  }

  /** هل نقطة (بإحداثيات اللوحة) جوه العقدة؟ مع هامش اختياري لتسهيل الإسقاط. */
  hitTest(point: Pt, margin = 0): boolean {
    const inverse = fabric.util.invertTransform(this.calcTransformMatrix());
    const local = fabric.util.transformPoint(
      new fabric.Point(point.x, point.y),
      inverse
    );
    return (
      Math.abs(local.x) <= this.width / 2 + margin &&
      Math.abs(local.y) <= this.height / 2 + margin
    );
  }

  /** يمسح كاش قياس النص (بعد تحميل خط جديد مثلًا) ويعيد حساب الحجم. */
  invalidateText() {
    this.measurerKey = "";
    this.fitToText();
    this.dirty = true;
    this.setCoords();
  }

  getSceneCenter(): Pt {
    const p = fabric.util.transformPoint(
      new fabric.Point(0, 0),
      this.calcTransformMatrix()
    );
    return { x: p.x, y: p.y };
  }

  /** كل نقاط الربط الأربعة (للتمييز أثناء السحب). */
  getAnchors() {
    return SIDES.map((side) => ({ side, ...this.getAnchor(side) }));
  }

  /** نقطة تبعد عن الضلع بمسافة معيّنة في اتجاه الخروج. */
  getExitPoint(side: Side, distance: number): Pt {
    const { point, normal } = this.getAnchor(side);
    return add(point, { x: normal.x * distance, y: normal.y * distance });
  }

  // ─────────── الرسم ───────────

  private applyShadow(ctx: CanvasRenderingContext2D) {
    const shadow = ELEVATION_SHADOW[this.effectiveElevation];
    if (!shadow) return;
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetY = shadow.offsetY;
  }

  private paintBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke: string | null,
    lineWidth: number
  ) {
    const radius = this.shape === "rect" ? this.cornerRadius : this.cornerRadius;
    if (!isTransparentColor(fill)) {
      ctx.save();
      this.applyShadow(ctx);
      traceShape(ctx, this.shape, x, y, w, h, radius);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }
    if (stroke && lineWidth > 0) {
      ctx.save();
      traceShape(ctx, this.shape, x, y, w, h, radius);
      ctx.setLineDash(this.strokeDashArray ?? []);
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();
    }
  }

  _render(ctx: CanvasRenderingContext2D) {
    const w = this.width;
    const h = this.height;
    const x = -w / 2;
    const y = -h / 2;
    const fill = typeof this.fill === "string" ? this.fill : "";
    const stroke = typeof this.stroke === "string" ? this.stroke : null;

    switch (this.look) {
      case "sticky":
      case "tape": {
        const fold = Math.min(26, w * 0.2, h * 0.2);
        ctx.save();
        this.applyShadow(ctx);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + fold, y + h);
        ctx.lineTo(x, y + h - fold);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();
        // الطيّة
        ctx.beginPath();
        ctx.moveTo(x, y + h - fold);
        ctx.lineTo(x + fold, y + h);
        ctx.lineTo(x + fold, y + h - fold);
        ctx.closePath();
        ctx.fillStyle = darken(fill, 0.14);
        ctx.fill();
        if (this.look === "tape") {
          const tw = Math.min(70, w * 0.42);
          ctx.save();
          ctx.translate(0, y + 10);
          ctx.rotate(-0.04);
          ctx.fillStyle = withAlpha(stroke || "#e8b229", 0.45);
          ctx.fillRect(-tw / 2, -9, tw, 20);
          ctx.restore();
        }
        break;
      }
      case "card": {
        const accent = stroke || "#1f6f63";
        this.paintBody(ctx, x, y, w, h, fill || "#ffffff", "#e1dccb", 1);
        ctx.save();
        traceShape(ctx, "rounded", x, y, w, h, this.cornerRadius);
        ctx.clip();
        ctx.fillStyle = accent;
        ctx.fillRect(x, y, w, 7);
        ctx.restore();
        break;
      }
      case "flat":
        this.paintBody(ctx, x, y, w, h, fill, null, 0);
        break;
      case "outline":
        this.paintBody(
          ctx,
          x,
          y,
          w,
          h,
          withAlpha(fill || "#ffffff", 0.55),
          stroke || "#1f6f63",
          Math.max(this.strokeWidth, 2)
        );
        break;
      default:
        this.paintBody(ctx, x, y, w, h, fill, stroke, this.strokeWidth);
    }

    if (!this.editing && this.label) this.paintLabel(ctx);
  }

  private paintLabel(ctx: CanvasRenderingContext2D) {
    const rect = this.getTextRect();
    const measurer = this.syncMeasurer(rect.w);
    const contentHeight = measurer.height;
    let top = rect.y;
    if (this.verticalAlign === "middle") top = rect.y + (rect.h - contentHeight) / 2;
    else if (this.verticalAlign === "bottom") top = rect.y + rect.h - contentHeight;
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, top + contentHeight / 2);
    measurer._render(ctx);
    ctx.restore();
  }
}

fabric.classRegistry.setClass(NodeObject);

export const isNode = (obj: unknown): obj is NodeObject =>
  obj instanceof NodeObject;
