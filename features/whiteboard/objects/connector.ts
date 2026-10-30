import * as fabric from "fabric";
import { connectorBridge } from "./bridge";
import { Pt, SIDE_NORMAL, Side, SIDES, distanceToSegment, scale } from "./geometry";
import type { NodeObject } from "./node";
import {
  HeadKind,
  RouteEnd,
  RouteKind,
  RoutedPath,
  bestSide,
  drawHead,
  headRetraction,
  headSize,
  routeConnector,
  routedBounds,
} from "./connectorRouting";

export type DashStyle = "solid" | "dashed" | "dotted";

/** طرف الرابط: متعلّق بعقدة (nodeId) أو حر في نقطة (x,y) من اللوحة. */
export interface ConnectorEnd {
  nodeId: string | null;
  side: Side | "auto";
  /** آخر موضع معروف للطرف (بيستخدم للأطراف الحرة وعند فك الارتباط) */
  x: number;
  y: number;
}

const CONNECTOR_PROPS = [
  "start",
  "end",
  "route",
  "startHead",
  "endHead",
  "dash",
  "cornerRadius",
] as const;

export interface ConnectorProps {
  start: ConnectorEnd;
  end: ConnectorEnd;
  route: RouteKind;
  startHead: HeadKind;
  endHead: HeadKind;
  dash: DashStyle;
  cornerRadius: number;
}

export const CONNECTOR_COLOR = "#211f1a";
const HALO_COLOR = "rgba(31, 111, 99, 0.28)";

function dashArray(style: DashStyle, width: number): number[] | null {
  if (style === "dashed") return [Math.max(8, width * 3.4), Math.max(6, width * 2.4)];
  if (style === "dotted") return [0.1, Math.max(6, width * 2.4)];
  return null;
}

function createConnectorControls(): Record<string, fabric.Control> {
  const make = (which: "start" | "end") =>
    new fabric.Control({
      actionName: "endpoint",
      sizeX: 16,
      sizeY: 16,
      touchSizeX: 34,
      touchSizeY: 34,
      cursorStyleHandler: () => "crosshair",
      positionHandler: (_dim, finalMatrix, fabricObject) => {
        const local = (fabricObject as ConnectorObject).localEnd(which);
        return new fabric.Point(local.x, local.y).transform(finalMatrix);
      },
      actionHandler: (_event, transform, x, y) =>
        connectorBridge.handlers?.drag(
          transform.target as ConnectorObject,
          which,
          { x, y }
        ) ?? false,
      mouseUpHandler: (_event, transform) => {
        connectorBridge.handlers?.release(transform.target as ConnectorObject, which);
        return true;
      },
      render: (ctx, left, top) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#1f6f63";
        ctx.stroke();
        ctx.restore();
      },
    });
  return { start: make("start"), end: make("end") };
}

/**
 * رابط بين عقدتين (أو نقطة حرة): خط مستقيم / متعرّج / منحني، برؤوس أسهم اختيارية
 * على الطرفين. هندسته بتتحسب كلها من أطرافه (`refresh`) فبيتبع العقد لما تتحرك.
 */
export class ConnectorObject extends fabric.FabricObject {
  static type = "FlowConnector";

  static connectorDefaults = {
    route: "straight" as RouteKind,
    startHead: "none" as HeadKind,
    endHead: "arrow" as HeadKind,
    dash: "solid" as DashStyle,
    cornerRadius: 12,
  };

  static getDefaults(): Record<string, unknown> {
    return { ...super.getDefaults(), ...ConnectorObject.connectorDefaults };
  }

  static createControls(): { controls: Record<string, fabric.Control> } {
    return { controls: createConnectorControls() };
  }

  declare start: ConnectorEnd;
  declare end: ConnectorEnd;
  declare route: RouteKind;
  declare startHead: HeadKind;
  declare endHead: HeadKind;
  declare dash: DashStyle;
  declare cornerRadius: number;

  routed: RoutedPath | null = null;
  private drawPath: Pt[] = [];
  private center: Pt = { x: 0, y: 0 };
  private lastCenter: Pt | null = null;

  constructor(options?: Partial<ConnectorProps> & Record<string, unknown>) {
    super();
    Object.assign(this, ConnectorObject.connectorDefaults);
    this.start = { nodeId: null, side: "auto", x: 0, y: 0 };
    this.end = { nodeId: null, side: "auto", x: 100, y: 0 };
    this.setOptions(options as never);
    this.stroke = typeof this.stroke === "string" ? this.stroke : CONNECTOR_COLOR;
    this.fill = "";
    this.strokeWidth = this.strokeWidth || 2;
    this.originX = "center";
    this.originY = "center";
    this.objectCaching = false;
    this.hasBorders = false;
    this.lockRotation = true;
    this.lockScalingX = true;
    this.lockScalingY = true;
    this.strokeUniform = true;
    // الهندسة بتتحسب أول مرة في refresh (المتحكّم بينادي عليها قبل كل رسم)
  }

  toObject(propertiesToInclude: string[] = []) {
    return super.toObject([...CONNECTOR_PROPS, ...propertiesToInclude] as never);
  }

  get isAttached() {
    return Boolean(this.start.nodeId || this.end.nodeId);
  }

  // ─────────── الهندسة ───────────

  /** موضع طرف بالنسبة لمركز الكائن (لعناصر التحكم). */
  localEnd(which: "start" | "end"): Pt {
    const end = this[which];
    return { x: end.x - this.center.x, y: end.y - this.center.y };
  }

  /**
   * يعيد حساب المسار من أطرافه. `find` بيرجّع العقدة من الـ id.
   * لازم يتنادى قبل كل رسم (المتحكّم بيعمل كده تلقائيًا).
   */
  refresh(find: (id: string) => NodeObject | undefined) {
    // لو الرابط اتسحب بنفسه (أطرافه الاتنين حرة) نحرّك الأطراف بنفس المسافة
    const current = { x: this.left, y: this.top };
    if (this.lastCenter) {
      const dx = current.x - this.lastCenter.x;
      const dy = current.y - this.lastCenter.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.01) {
        for (const e of [this.start, this.end]) {
          if (!e.nodeId) {
            e.x += dx;
            e.y += dy;
          }
        }
      }
    }

    const nodes = [this.start, this.end].map((e) =>
      e.nodeId ? find(e.nodeId) : undefined
    );
    [this.start, this.end].forEach((e, i) => {
      if (e.nodeId && !nodes[i]) e.nodeId = null; // العقدة اتحذفت: الطرف يفضل حر
    });

    const resolve = (i: 0 | 1): RouteEnd => {
      const e = i === 0 ? this.start : this.end;
      const node = nodes[i];
      if (!node) return { point: { x: e.x, y: e.y }, normal: null };

      const otherNode = nodes[1 - i];
      const other = i === 0 ? this.end : this.start;
      const target = otherNode ? otherNode.getSceneCenter() : { x: other.x, y: other.y };
      let side: Side;
      if (e.side === "auto") {
        const normals = {} as Record<Side, Pt>;
        for (const s of SIDES) normals[s] = node.getAnchor(s).normal;
        side = bestSide(normals, node.getSceneCenter(), target);
      } else {
        side = e.side;
      }
      const anchor = node.getAnchor(side);
      e.x = anchor.point.x;
      e.y = anchor.point.y;
      return { point: anchor.point, normal: anchor.normal };
    };

    const a = resolve(0);
    const b = resolve(1);
    const routed = routeConnector(a, b, this.route);
    this.routed = routed;

    // نقصّر الخط عند الرؤوس المصمتة
    const sw = this.strokeWidth;
    const startCut = headRetraction(this.startHead, sw);
    const endCut = headRetraction(this.endHead, sw);
    const points = routed.points.map((p) => ({ ...p }));
    if (startCut > 0) {
      const moved = scale(routed.startDir, startCut);
      points[0] = { x: points[0].x + moved.x, y: points[0].y + moved.y };
    }
    if (endCut > 0) {
      const moved = scale(routed.endDir, endCut);
      const last = points.length - 1;
      points[last] = { x: points[last].x - moved.x, y: points[last].y - moved.y };
    }
    this.drawPath = points;

    const pad = Math.max(headSize(sw), 10) + sw + 6;
    const bounds = routedBounds(routed, pad);
    this.center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    this.set({
      left: this.center.x,
      top: this.center.y,
      width: Math.max(bounds.maxX - bounds.minX - sw, 1),
      height: Math.max(bounds.maxY - bounds.minY - sw, 1),
      strokeDashArray: dashArray(this.dash, sw),
    });
    this.lastCenter = { x: this.left, y: this.top };

    const locked = this.isAttached;
    this.lockMovementX = locked;
    this.lockMovementY = locked;
    this.setCoords();
  }

  /** هل نقطة (بإحداثيات اللوحة) قريبة من الخط؟ (بدل صندوق الحدود الكبير) */
  containsPoint(point: fabric.Point): boolean {
    if (!this.routed) return false;
    const zoom = this.canvas?.getZoom() ?? 1;
    const tolerance = this.strokeWidth / 2 + 8 / zoom;
    const samples = this.routed.samples;
    for (let i = 0; i < samples.length - 1; i++) {
      if (distanceToSegment(point, samples[i], samples[i + 1]) <= tolerance) return true;
    }
    return false;
  }

  // ─────────── الرسم ───────────

  private tracePath(ctx: CanvasRenderingContext2D) {
    const routed = this.routed;
    if (!routed) return;
    const local = (p: Pt) => ({ x: p.x - this.center.x, y: p.y - this.center.y });
    const pts = this.drawPath.map(local);
    ctx.beginPath();
    if (routed.kind === "bezier") {
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
      return;
    }
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const here = pts[i];
      const next = pts[i + 1];
      const radius = Math.min(
        this.route === "elbow" ? this.cornerRadius : 0,
        Math.hypot(here.x - prev.x, here.y - prev.y) / 2,
        Math.hypot(next.x - here.x, next.y - here.y) / 2
      );
      if (radius > 0.5) ctx.arcTo(here.x, here.y, next.x, next.y, radius);
      else ctx.lineTo(here.x, here.y);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  _render(ctx: CanvasRenderingContext2D) {
    const routed = this.routed;
    if (!routed) return;
    const color = typeof this.stroke === "string" ? this.stroke : CONNECTOR_COLOR;
    const selected = this.canvas?.getActiveObject() === this;

    if (selected) {
      ctx.save();
      this.tracePath(ctx);
      ctx.lineWidth = this.strokeWidth + 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = HALO_COLOR;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    this.tracePath(ctx);
    ctx.setLineDash(this.strokeDashArray ?? []);
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = this.dash === "dotted" ? "round" : "butt";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();

    const local = (p: Pt) => ({ x: p.x - this.center.x, y: p.y - this.center.y });
    const first = routed.points[0];
    const last = routed.points[routed.points.length - 1];
    drawHead(
      ctx,
      this.startHead,
      local(first),
      { x: -routed.startDir.x, y: -routed.startDir.y },
      this.strokeWidth,
      color
    );
    drawHead(ctx, this.endHead, local(last), routed.endDir, this.strokeWidth, color);
  }
}

fabric.classRegistry.setClass(ConnectorObject);

export const isConnector = (obj: unknown): obj is ConnectorObject =>
  obj instanceof ConnectorObject;

export { SIDE_NORMAL };
