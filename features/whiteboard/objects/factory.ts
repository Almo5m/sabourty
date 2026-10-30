import { ConnectorEnd, ConnectorObject, ConnectorProps, DashStyle } from "./connector";
import { Pt, Side } from "./geometry";
import { NodeObject, NodeProps } from "./node";

/** دوال إنشاء جاهزة للعقد والروابط (بتتستخدم في الأدوات وفي القوالب). */

export interface LayerMeta {
  name?: string;
  kind?: string;
}

type Tagged = { id?: string; name?: string; kind?: string };

function tag(obj: object, meta: LayerMeta) {
  const t = obj as Tagged;
  t.id = crypto.randomUUID();
  if (meta.name) t.name = meta.name;
  if (meta.kind) t.kind = meta.kind;
}

export const dashToArray = (dash: DashStyle, width: number): number[] | null => {
  if (dash === "dashed") return [Math.max(8, width * 3.4), Math.max(6, width * 2.4)];
  if (dash === "dotted") return [0.1, Math.max(6, width * 2.4)];
  return null;
};

export function getNodeId(node: NodeObject): string {
  return (node as unknown as Tagged).id ?? "";
}

export interface NodeSpec extends Partial<NodeProps> {
  left: number;
  top: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: DashStyle;
  meta?: LayerMeta;
}

export function makeNode(spec: NodeSpec): NodeObject {
  const { meta, dash, ...props } = spec;
  const node = new NodeObject({
    strokeWidth: 2,
    ...props,
    strokeDashArray: dash ? dashToArray(dash, spec.strokeWidth ?? 2) : null,
  });
  tag(node, meta ?? { name: "عقدة", kind: "rectangle" });
  return node;
}

export interface EndSpec {
  node?: NodeObject;
  side?: Side | "auto";
  point?: Pt;
}

function toEnd(spec: EndSpec): ConnectorEnd {
  if (spec.node) {
    const c = spec.node.getSceneCenter();
    return { nodeId: getNodeId(spec.node), side: spec.side ?? "auto", x: c.x, y: c.y };
  }
  return { nodeId: null, side: "auto", x: spec.point?.x ?? 0, y: spec.point?.y ?? 0 };
}

export interface ConnectorSpec extends Partial<Omit<ConnectorProps, "start" | "end">> {
  from: EndSpec;
  to: EndSpec;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  meta?: LayerMeta;
}

export function makeConnector(spec: ConnectorSpec): ConnectorObject {
  const { from, to, meta, ...props } = spec;
  const connector = new ConnectorObject({
    ...props,
    start: toEnd(from),
    end: toEnd(to),
  });
  tag(connector, meta ?? { name: "رابط", kind: "arrow" });
  return connector;
}
