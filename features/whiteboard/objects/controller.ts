import * as fabric from "fabric";
import { connectorBridge, nodeBridge } from "./bridge";
import { ConnectorObject, DashStyle, isConnector } from "./connector";
import {
  EndSpec,
  getNodeId,
  makeConnector,
  makeNode,
} from "./factory";
import { Pt, SIDE_NORMAL, Side, distance } from "./geometry";
import { MIN_NODE_HEIGHT, MIN_NODE_WIDTH, NodeObject, NodeProps, isNode } from "./node";
import { NodeLook, NOTE_COLORS } from "./nodeLooks";
import { NodeShape, traceShape } from "./nodeShapes";
import { NodeTextEditor } from "./nodeTextEditor";
import { HeadKind, RouteKind } from "./connectorRouting";
import { loadFont } from "../lib/fonts";
import { flattenObjects } from "./sync";

export interface DiagramHooks {
  /** حصل تغيير يستاهل لقطة تراجع/حفظ */
  onCommit(): void;
  /** الاختيار أو خصائص العنصر المختار اتغيّرت (null = مفيش حاجة تتعدّل) */
  onSelectionChange(model: InspectorModel | null): void;
  onEditingChange(editing: boolean): void;
  getTool(): string;
}

export interface ShapeStyle {
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface NoteStyle {
  look: NodeLook;
  fill: string;
  accent: string;
}

export const DEFAULT_NOTE_STYLE: NoteStyle = {
  look: "sticky",
  fill: NOTE_COLORS[0].fill,
  accent: NOTE_COLORS[0].accent,
};

/** أدوات الأشكال → هندسة العقدة */
const SHAPE_TOOLS: Record<string, { shape: NodeShape; name: string; icon: string; size: [number, number] }> = {
  rectangle: { shape: "rect", name: "مستطيل", icon: "rectangle", size: [160, 100] },
  rounded: { shape: "rounded", name: "مستطيل مدوّر", icon: "rectangle", size: [160, 100] },
  pill: { shape: "pill", name: "كبسولة", icon: "rectangle", size: [170, 70] },
  circle: { shape: "ellipse", name: "دائرة", icon: "circle", size: [120, 120] },
  diamond: { shape: "diamond", name: "معيّن", icon: "shapes", size: [150, 120] },
  triangle: { shape: "triangle", name: "مثلث", icon: "triangle", size: [140, 120] },
  hexagon: { shape: "hexagon", name: "سداسي", icon: "shapes", size: [160, 110] },
  parallelogram: { shape: "parallelogram", name: "متوازي أضلاع", icon: "shapes", size: [170, 100] },
  star: { shape: "star", name: "نجمة", icon: "star", size: [130, 130] },
};

const CONNECTOR_TOOLS: Record<string, { route: RouteKind; endHead: HeadKind; name: string }> = {
  line: { route: "straight", endHead: "none", name: "خط" },
  arrow: { route: "straight", endHead: "arrow", name: "سهم" },
  elbow: { route: "elbow", endHead: "arrow", name: "سهم متعرّج" },
  curve: { route: "curve", endHead: "arrow", name: "سهم منحني" },
};

export const isShapeTool = (tool: string) => tool in SHAPE_TOOLS;
export const isConnectorTool = (tool: string) => tool in CONNECTOR_TOOLS;
export const isDiagramTool = (tool: string) =>
  isShapeTool(tool) || isConnectorTool(tool) || tool === "sticky";

/** لقطة من خصائص العنصر المختار، بتتبعت للواجهة (لوحة الخصائص). */
export interface InspectorModel {
  nodeCount: number;
  connectorCount: number;
  textCount: number;
  editing: boolean;
  node?: {
    shape: NodeShape;
    look: NodeLook;
    fill: string;
    stroke: string;
    strokeWidth: number;
    dash: DashStyle;
    opacity: number;
    cornerRadius: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: "normal" | "bold";
    fontStyle: "normal" | "italic";
    textAlign: "right" | "center" | "left";
    verticalAlign: "top" | "middle" | "bottom";
    textColor: string;
  };
  connector?: {
    route: RouteKind;
    startHead: HeadKind;
    endHead: HeadKind;
    dash: DashStyle;
    stroke: string;
    strokeWidth: number;
    opacity: number;
  };
  text?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: "normal" | "bold";
    fontStyle: "normal" | "italic";
    textAlign: "left" | "center" | "right";
    fill: string;
    opacity: number;
  };
}

function dashOf(array: number[] | null | undefined): DashStyle {
  if (!array || array.length === 0) return "solid";
  return array[0] < 1 ? "dotted" : "dashed";
}

export interface DiagramTargets {
  nodes: NodeObject[];
  connectors: ConnectorObject[];
  texts: fabric.Textbox[];
}

export type NodePatch = Partial<NodeProps> & {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: DashStyle;
};

export interface ConnectorPatch {
  route?: RouteKind;
  startHead?: HeadKind;
  endHead?: HeadKind;
  dash?: DashStyle;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export type TextPatch = Partial<{
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  fill: string;
  opacity: number;
  lineHeight: number;
}>;

interface ToolContext {
  shape: ShapeStyle;
  note: NoteStyle;
}

interface DrawState {
  node: NodeObject;
  origin: Pt;
  tool: string;
}

interface ConnectState {
  connector: ConnectorObject | null;
  fromNode: NodeObject | null;
  fromSide: Side | "auto";
  origin: Pt;
  /** تعديل طرف رابط موجود بدل إنشاء جديد */
  editing: { which: "start" | "end" } | null;
  style: ShapeStyle;
  spec?: { route: RouteKind; endHead: HeadKind };
}

const SNAP_PX = 18;
const HIT_MARGIN_PX = 14;

/**
 * متحكّم الرسم التخطيطي: كل منطق العقد والروابط على مستوى الكانفا.
 * - بيحدّث الروابط تلقائيًا قبل كل رسم (فبتتبع العقد في السحب والتكبير والتراجع).
 * - بيتولّى رسم الأشكال والملاحظات والروابط بالأدوات، والسحب من نقاط الربط.
 * - بيفتح محرّر النص بالنقر المزدوج (أو Enter / F2).
 */
export class DiagramController {
  readonly editor: NodeTextEditor;
  private hover: NodeObject | null = null;
  private drawing: DrawState | null = null;
  private connect: ConnectState | null = null;
  /** ملاحظة اتعملت لسه، ومحرّر النص هيتفتح عند رفع الإصبع (مش وقت الضغط) */
  private pendingEdit: NodeObject | null = null;
  private lastTap: { id: string; time: number; x: number; y: number } | null = null;
  private commitTimer: number | null = null;
  private syncing = false;
  private readonly fontsChecked = new Set<string>();
  private toolContext: ToolContext = {
    shape: { stroke: "#211f1a", strokeWidth: 2, opacity: 1 },
    note: DEFAULT_NOTE_STYLE,
  };

  constructor(
    private readonly canvas: fabric.Canvas,
    private readonly hooks: DiagramHooks
  ) {
    this.editor = new NodeTextEditor(canvas, {
      onCommit: () => this.hooks.onCommit(),
      onEditingChange: (editing) => this.hooks.onEditingChange(editing),
    });

    canvas.on("before:render", this.sync);
    canvas.on("after:render", this.paintOverlay);
    canvas.on("mouse:up", this.onMouseUp);
    canvas.on("mouse:dblclick", this.onDoubleClick);
    canvas.on("selection:created", this.onSelection);
    canvas.on("selection:updated", this.onSelection);
    canvas.on("selection:cleared", this.onSelection);
    canvas.on("object:modified", this.onModified);
    window.addEventListener("keydown", this.onKeyDown);

    nodeBridge.handlers = {
      start: (node, side) => this.beginFromNode(node, side),
      move: (_node, _side, x, y) => this.moveConnect({ x, y }),
      end: (node, side) => this.endFromNode(node, side),
    };
    connectorBridge.handlers = {
      drag: (connector, which, point) => this.dragEndpoint(connector, which, point),
      release: () => {
        this.hover = null;
        this.canvas.requestRenderAll();
        this.hooks.onCommit();
      },
    };
  }

  dispose() {
    this.canvas.off("before:render", this.sync);
    this.canvas.off("after:render", this.paintOverlay);
    this.canvas.off("mouse:up", this.onMouseUp);
    this.canvas.off("mouse:dblclick", this.onDoubleClick);
    this.canvas.off("selection:created", this.onSelection);
    this.canvas.off("selection:updated", this.onSelection);
    this.canvas.off("selection:cleared", this.onSelection);
    this.canvas.off("object:modified", this.onModified);
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.commitTimer) window.clearTimeout(this.commitTimer);
    nodeBridge.handlers = null;
    connectorBridge.handlers = null;
    this.editor.destroy();
  }

  // ─────────── البحث ───────────

  private allObjects(): fabric.FabricObject[] {
    return flattenObjects(this.canvas.getObjects());
  }

  nodes(): NodeObject[] {
    return this.allObjects().filter(isNode);
  }

  findNode = (id: string): NodeObject | undefined =>
    this.nodes().find((node) => getNodeId(node) === id);

  /** أعلى عقدة تحت نقطة (بتتجاهل `exclude`). */
  nodeAt(point: Pt, exclude?: NodeObject | null): NodeObject | null {
    const margin = HIT_MARGIN_PX / this.canvas.getZoom();
    const all = this.nodes();
    for (let i = all.length - 1; i >= 0; i--) {
      const node = all[i];
      if (node === exclude) continue;
      if (node.hitTest(point, margin)) return node;
    }
    return null;
  }

  // ─────────── مزامنة الروابط (قبل كل رسم) ───────────

  private sync = () => {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const objects = this.allObjects();
      const byId = new Map<string, NodeObject>();
      for (const obj of objects) {
        if (!isNode(obj)) continue;
        byId.set(getNodeId(obj), obj);
        // أي تكبير بالسحب يتحوّل لتغيير أبعاد حقيقي (عشان النص ما يتمطّش)
        if (!obj.group && (Math.abs(obj.scaleX - 1) > 1e-3 || Math.abs(obj.scaleY - 1) > 1e-3)) {
          obj.set({
            width: obj.width * obj.scaleX,
            height: obj.height * obj.scaleY,
            scaleX: 1,
            scaleY: 1,
          });
        }
        if (obj.width < MIN_NODE_WIDTH || obj.height < MIN_NODE_HEIGHT) {
          if (!this.drawing || this.drawing.node !== obj) {
            obj.set({
              width: Math.max(obj.width, MIN_NODE_WIDTH),
              height: Math.max(obj.height, MIN_NODE_HEIGHT),
            });
          }
        }
        if (!this.drawing || this.drawing.node !== obj) obj.fitToText();
        obj.setCoords();
      }
      for (const obj of objects) {
        if (isConnector(obj)) obj.refresh((id) => byId.get(id));
      }
    } finally {
      this.syncing = false;
    }
  };

  // ─────────── طبقة التمييز أثناء الربط ───────────

  private paintOverlay = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    const node = this.hover;
    if (!node || ctx !== this.canvas.getContext()) return;
    const zoom = this.canvas.getZoom();
    const vpt = this.canvas.viewportTransform;
    ctx.save();
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    ctx.save();
    const m = node.calcTransformMatrix();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    const grow = 6 / zoom;
    traceShape(
      ctx,
      node.shape,
      -node.width / 2 - grow,
      -node.height / 2 - grow,
      node.width + grow * 2,
      node.height + grow * 2,
      node.cornerRadius + grow
    );
    ctx.lineWidth = 3 / zoom;
    ctx.strokeStyle = "rgba(31, 111, 99, 0.9)";
    ctx.stroke();
    ctx.restore();
    for (const anchor of node.getAnchors()) {
      ctx.beginPath();
      ctx.arc(anchor.point.x, anchor.point.y, 6 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2.5 / zoom;
      ctx.strokeStyle = "#1f6f63";
      ctx.stroke();
    }
    ctx.restore();
  };

  // ─────────── الاختيار والتحرير ───────────

  private onSelection = () => {
    // الروابط ما بتدخلش في التحديد المتعدد: بتتحرك تلقائيًا مع عقدها
    const active = this.canvas.getActiveObject();
    if (active instanceof fabric.ActiveSelection) {
      const connectors = active.getObjects().filter(isConnector);
      if (connectors.length > 0) {
        connectors.forEach((c) => active.remove(c));
        this.canvas.requestRenderAll();
      }
    }
    this.notifySelection();
  };

  private onModified = () => this.notifySelection();

  private onMouseUp = (opt: { target?: fabric.FabricObject; isClick?: boolean; e: fabric.TPointerEvent }) => {
    if (this.hooks.getTool() !== "select") return;
    const target = opt.target;
    if (!target || !isNode(target) || !opt.isClick) {
      this.lastTap = null;
      return;
    }
    const point = this.canvas.getScenePoint(opt.e);
    const now = Date.now();
    const id = getNodeId(target);
    const tap = this.lastTap;
    if (tap && tap.id === id && now - tap.time < 400 && Math.hypot(point.x - tap.x, point.y - tap.y) < 14 / this.canvas.getZoom()) {
      this.lastTap = null;
      this.editNode(target);
    } else {
      this.lastTap = { id, time: now, x: point.x, y: point.y };
    }
  };

  /** نقر مزدوج سريع جدًا (المتصفح بيبعته كـ dblclick) بيفتح المحرّر زي النقر المزدوج اليدوي. */
  private onDoubleClick = (opt: { target?: fabric.FabricObject }) => {
    if (this.hooks.getTool() !== "select") return;
    if (opt.target && isNode(opt.target)) this.editNode(opt.target);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
    if (e.key !== "Enter" && e.key !== "F2") return;
    const active = this.canvas.getActiveObject();
    if (active && isNode(active)) {
      e.preventDefault();
      this.editNode(active, true);
    }
  };

  editNode(node: NodeObject, selectAll = false) {
    this.canvas.setActiveObject(node);
    this.editor.open(node, selectAll);
  }

  // ─────────── الإنشاء بالأدوات ───────────

  setToolContext(context: ToolContext) {
    this.toolContext = context;
  }

  /** بداية رسم بأداة شكل/ملاحظة/رابط. بترجّع true لو الأداة تخص المتحكّم. */
  pointerDown(tool: string, point: Pt): boolean {
    if (isShapeTool(tool)) {
      this.beginShape(tool, point);
      return true;
    }
    if (tool === "sticky") {
      this.createNote(point);
      return true;
    }
    if (isConnectorTool(tool)) {
      this.beginToolConnector(tool, point);
      return true;
    }
    return false;
  }

  pointerMove(point: Pt): boolean {
    if (this.drawing) {
      this.dragShape(point);
      return true;
    }
    if (this.connect) {
      this.moveConnect(point);
      return true;
    }
    return false;
  }

  /** نهاية الرسم. بترجّع true لو كان في عملية رسم انتهت (فالأداة ترجع للتحديد). */
  pointerUp(): boolean {
    if (this.pendingEdit) {
      // التركيز لازم ينتقل للمحرّر بعد ما الضغطة تخلص، وإلا المتصفح بيسحبه منه
      const node = this.pendingEdit;
      this.pendingEdit = null;
      this.editNode(node);
      return true;
    }
    if (this.drawing) {
      this.finishShape();
      return true;
    }
    if (this.connect) {
      this.finishConnect();
      return true;
    }
    return false;
  }

  private beginShape(tool: string, point: Pt) {
    const def = SHAPE_TOOLS[tool];
    const { stroke, strokeWidth, opacity } = this.toolContext.shape;
    const node = makeNode({
      left: point.x,
      top: point.y,
      width: 1,
      height: 1,
      shape: def.shape,
      stroke,
      strokeWidth,
      opacity,
      fill: "",
      meta: { name: def.name, kind: def.icon },
    });
    this.canvas.add(node);
    this.drawing = { node, origin: point, tool };
  }

  private dragShape(point: Pt) {
    const state = this.drawing;
    if (!state) return;
    const dx = point.x - state.origin.x;
    const dy = point.y - state.origin.y;
    state.node.set({
      left: Math.min(point.x, state.origin.x),
      top: Math.min(point.y, state.origin.y),
      width: Math.abs(dx),
      height: Math.abs(dy),
    });
    state.node.setCoords();
    this.canvas.requestRenderAll();
  }

  private finishShape() {
    const state = this.drawing;
    this.drawing = null;
    if (!state) return;
    const { node, origin, tool } = state;
    if (node.width < 12 && node.height < 12) {
      // نقرة بدون سحب: حجم افتراضي متمركز عند النقطة
      const [w, h] = SHAPE_TOOLS[tool].size;
      node.set({ width: w, height: h, left: origin.x - w / 2, top: origin.y - h / 2 });
    }
    node.fitToText();
    node.setCoords();
    this.canvas.setActiveObject(node);
    this.canvas.requestRenderAll();
    this.hooks.onCommit();
  }

  private createNote(point: Pt) {
    const { look, fill, accent } = this.toolContext.note;
    const node = this.makeNote(point.x - 100, point.y - 85, look, fill, accent);
    this.canvas.add(node);
    this.canvas.setActiveObject(node);
    this.hooks.onCommit();
    this.pendingEdit = node;
  }

  makeNote(left: number, top: number, look: NodeLook, fill: string, accent: string) {
    return makeNode({
      left,
      top,
      width: 200,
      height: 170,
      look,
      shape: look === "flat" ? "rounded" : "rect",
      fill,
      stroke: accent,
      strokeWidth: 2,
      cornerRadius: look === "flat" || look === "outline" || look === "card" ? 14 : 0,
      fontSize: 18,
      textAlign: "right",
      verticalAlign: "top",
      meta: { name: "ملاحظة", kind: "sticky" },
    });
  }

  // ─────────── الروابط ───────────

  private snapSide(node: NodeObject, point: Pt): Side | "auto" {
    const threshold = SNAP_PX / this.canvas.getZoom();
    for (const anchor of node.getAnchors()) {
      if (distance(anchor.point, point) <= threshold) return anchor.side;
    }
    return "auto";
  }

  private beginToolConnector(tool: string, point: Pt) {
    const spec = CONNECTOR_TOOLS[tool];
    const node = this.nodeAt(point);
    this.connect = {
      connector: null,
      fromNode: node,
      fromSide: node ? this.snapSide(node, point) : "auto",
      origin: point,
      editing: null,
      style: this.toolContext.shape,
      spec,
    };
    this.ensureConnector(point, true);
  }

  private beginFromNode(node: NodeObject, side: Side) {
    this.connect = {
      connector: null,
      fromNode: node,
      fromSide: side,
      origin: node.getAnchor(side).point,
      editing: null,
      style: this.toolContext.shape,
    };
  }

  private ensureConnector(point: Pt, force = false) {
    const state = this.connect;
    if (!state || state.connector) return;
    if (!force && distance(point, state.origin) < 8 / this.canvas.getZoom()) return;
    const spec = state.spec ?? { route: "straight" as RouteKind, endHead: "arrow" as HeadKind };
    const from: EndSpec = state.fromNode
      ? { node: state.fromNode, side: state.fromSide }
      : { point: state.origin };
    const connector = makeConnector({
      from,
      to: { point },
      route: spec.route,
      endHead: spec.endHead,
      stroke: state.style.stroke,
      strokeWidth: Math.max(1.5, state.style.strokeWidth),
      opacity: state.style.opacity,
    });
    state.connector = connector;
    this.canvas.add(connector);
  }

  private moveConnect(point: Pt) {
    const state = this.connect;
    if (!state) return;
    this.ensureConnector(point);
    if (state.connector) this.retarget(state.connector, "end", point, state.fromNode);
  }

  /** ينقل طرف رابط لنقطة: عقدة تحتها (ربط) أو نقطة حرة. */
  private retarget(
    connector: ConnectorObject,
    which: "start" | "end",
    point: Pt,
    avoid: NodeObject | null
  ) {
    const end = connector[which];
    const node = this.nodeAt(point, avoid);
    this.hover = node;
    if (node) {
      end.nodeId = getNodeId(node);
      end.side = this.snapSide(node, point);
    } else {
      end.nodeId = null;
      end.side = "auto";
      end.x = point.x;
      end.y = point.y;
    }
    this.canvas.requestRenderAll();
  }

  private dragEndpoint(connector: ConnectorObject, which: "start" | "end", point: Pt): boolean {
    const other = connector[which === "start" ? "end" : "start"];
    const avoid = other.nodeId ? this.findNode(other.nodeId) ?? null : null;
    this.retarget(connector, which, point, avoid);
    return true;
  }

  private endFromNode(node: NodeObject, side: Side) {
    const state = this.connect;
    if (!state) return;
    if (!state.connector) {
      // نقرة على نقطة الربط: نفتح عقدة فرعية جديدة متصلة
      this.connect = null;
      this.hover = null;
      this.spawnChild(node, side);
      return;
    }
    this.finishConnect();
  }

  private finishConnect() {
    const state = this.connect;
    this.connect = null;
    this.hover = null;
    if (!state) return;
    const connector = state.connector;
    if (!connector) return;
    const tiny =
      !connector.start.nodeId &&
      !connector.end.nodeId &&
      distance(connector.start, connector.end) < 10;
    if (tiny) {
      this.canvas.remove(connector);
    } else {
      this.canvas.setActiveObject(connector);
      this.hooks.onCommit();
    }
    this.canvas.requestRenderAll();
  }

  /** عقدة جديدة بجانب عقدة موجودة، بنفس شكلها ولونها، ومتصلة بيها. */
  spawnChild(parent: NodeObject, side: Side) {
    const normal = SIDE_NORMAL[side];
    const gap = 90;
    const center = parent.getSceneCenter();
    const w = parent.width;
    const h = parent.height;
    const reach =
      Math.abs(normal.x) > 0 ? w / 2 + gap + w / 2 : h / 2 + gap + h / 2;
    const child = makeNode({
      left: center.x + normal.x * reach - w / 2,
      top: center.y + normal.y * reach - h / 2,
      width: w,
      height: h,
      shape: parent.shape,
      look: parent.look,
      fill: typeof parent.fill === "string" ? parent.fill : "",
      stroke: typeof parent.stroke === "string" ? parent.stroke : undefined,
      strokeWidth: parent.strokeWidth,
      opacity: parent.opacity,
      fontFamily: parent.fontFamily,
      fontSize: parent.fontSize,
      fontWeight: parent.fontWeight,
      fontStyle: parent.fontStyle,
      textAlign: parent.textAlign,
      verticalAlign: parent.verticalAlign,
      textColor: parent.textColor,
      cornerRadius: parent.cornerRadius,
      meta: { name: (parent as unknown as { name?: string }).name ?? "عقدة", kind: (parent as unknown as { kind?: string }).kind ?? "rectangle" },
    });
    const opposite: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
    const connector = makeConnector({
      from: { node: parent, side },
      to: { node: child, side: opposite[side] },
      route: parent.look === "plain" ? "straight" : "curve",
      endHead: parent.look === "plain" ? "arrow" : "none",
      stroke: parent.look === "plain" && typeof parent.stroke === "string" ? parent.stroke : "#8a826c",
      strokeWidth: 2,
    });
    this.canvas.add(child);
    this.canvas.add(connector);
    this.canvas.setActiveObject(child);
    this.hooks.onCommit();
    this.editNode(child, false);
  }

  // ─────────── تعديل الخصائص (للوحة الخصائص) ───────────

  getTargets(): DiagramTargets {
    const active = this.canvas.getActiveObject();
    const objects =
      active instanceof fabric.ActiveSelection ? active.getObjects() : active ? [active] : [];
    return {
      nodes: objects.filter(isNode),
      connectors: objects.filter(isConnector),
      texts: objects.filter((o): o is fabric.Textbox => o instanceof fabric.Textbox),
    };
  }

  notifySelection() {
    this.hooks.onSelectionChange(this.getInspectorModel());
  }

  getInspectorModel(): InspectorModel | null {
    const { nodes, connectors, texts } = this.getTargets();
    if (nodes.length + connectors.length + texts.length === 0) return null;
    const model: InspectorModel = {
      nodeCount: nodes.length,
      connectorCount: connectors.length,
      textCount: texts.length,
      editing: this.editor.isOpen,
    };
    const node = nodes[0];
    if (node) {
      model.node = {
        shape: node.shape,
        look: node.look,
        fill: typeof node.fill === "string" ? node.fill : "",
        stroke: typeof node.stroke === "string" ? node.stroke : "",
        strokeWidth: node.strokeWidth,
        dash: dashOf(node.strokeDashArray),
        opacity: node.opacity,
        cornerRadius: node.cornerRadius,
        fontFamily: node.fontFamily,
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        fontStyle: node.fontStyle,
        textAlign: node.textAlign,
        verticalAlign: node.verticalAlign,
        textColor: node.resolvedTextColor,
      };
    }
    const connector = connectors[0];
    if (connector) {
      model.connector = {
        route: connector.route,
        startHead: connector.startHead,
        endHead: connector.endHead,
        dash: connector.dash,
        stroke: typeof connector.stroke === "string" ? connector.stroke : "#211f1a",
        strokeWidth: connector.strokeWidth,
        opacity: connector.opacity,
      };
    }
    const text = texts[0];
    if (text) {
      model.text = {
        fontFamily: text.fontFamily,
        fontSize: text.fontSize,
        fontWeight: text.fontWeight as "normal" | "bold",
        fontStyle: text.fontStyle as "normal" | "italic",
        textAlign: (text.textAlign as "left" | "center" | "right") ?? "right",
        fill: typeof text.fill === "string" ? text.fill : "#211f1a",
        opacity: text.opacity,
      };
    }
    return model;
  }

  /** مستطيل العنصر المختار بإحداثيات الشاشة (لتحديد مكان لوحة الخصائص). */
  getAnchorRect(): { left: number; top: number; right: number; bottom: number } | null {
    const active = this.canvas.getActiveObject();
    if (!active) return null;
    const r = active.getBoundingRect();
    return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
  }

  /** اشتراك في كل إعادة رسم (لتتبّع لوحة الخصائص للعنصر). بيرجّع دالة إلغاء الاشتراك. */
  onRender(callback: () => void): () => void {
    this.canvas.on("after:render", callback);
    return () => this.canvas.off("after:render", callback);
  }

  getViewSize() {
    return { width: this.canvas.getWidth(), height: this.canvas.getHeight() };
  }

  applyNodePatch(patch: NodePatch) {
    const { dash, ...rest } = patch;
    for (const node of this.getTargets().nodes) {
      const values: Record<string, unknown> = { ...rest };
      if (dash) {
        const width = (rest.strokeWidth ?? node.strokeWidth) || 2;
        values.strokeDashArray =
          dash === "dashed"
            ? [Math.max(8, width * 3.4), Math.max(6, width * 2.4)]
            : dash === "dotted"
              ? [0.1, Math.max(6, width * 2.4)]
              : null;
      }
      node.patch(values as never);
    }
    if (patch.fontFamily) void this.ensureFont(patch.fontFamily);
    this.afterPatch();
  }

  applyConnectorPatch(patch: ConnectorPatch) {
    for (const connector of this.getTargets().connectors) {
      connector.set(patch as never);
      connector.dirty = true;
    }
    this.afterPatch();
  }

  applyTextPatch(patch: TextPatch) {
    for (const text of this.getTargets().texts) {
      text.set(patch as never);
      text.initDimensions();
      text.setCoords();
    }
    if (patch.fontFamily) void this.ensureFont(patch.fontFamily);
    this.afterPatch();
  }

  private afterPatch() {
    this.canvas.requestRenderAll();
    this.notifySelection();
    if (this.commitTimer) window.clearTimeout(this.commitTimer);
    this.commitTimer = window.setTimeout(() => this.hooks.onCommit(), 450);
  }

  // ─────────── الخطوط ───────────

  /** يحمّل خط جوجل ويعيد قياس كل النصوص اللي بتستخدمه. */
  async ensureFont(family: string) {
    if (this.fontsChecked.has(family)) return;
    this.fontsChecked.add(family);
    const loaded = await loadFont(family);
    if (loaded) this.remeasure(family);
  }

  private remeasure(family?: string) {
    for (const obj of this.allObjects()) {
      if (isNode(obj) && (!family || obj.fontFamily === family)) obj.invalidateText();
      else if (obj instanceof fabric.Textbox && (!family || obj.fontFamily === family)) {
        obj.initDimensions();
        obj.setCoords();
      }
    }
    this.canvas.requestRenderAll();
  }

  /** بعد تحميل لوحة: يحمّل كل خطوط جوجل المستخدمة فيها. */
  async ensureBoardFonts() {
    const families = new Set<string>();
    for (const obj of this.allObjects()) {
      if (isNode(obj) || obj instanceof fabric.Textbox) families.add(obj.fontFamily);
    }
    await Promise.all([...families].map((family) => this.ensureFont(family)));
  }
}
