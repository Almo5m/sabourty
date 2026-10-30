import * as fabric from "fabric";
import { ConnectorObject } from "../objects/connector";
import { makeConnector, makeNode } from "../objects/factory";
import { NodeObject } from "../objects/node";
import { NOTE_COLORS } from "../objects/nodeLooks";
import type { IconName } from "@/features/shared/icons/Icon";

export type TemplateId =
  | "mindmap"
  | "orgchart"
  | "timeline"
  | "fishbone"
  | "flowchart";

export interface TemplateInfo {
  id: TemplateId;
  title: string;
  description: string;
  icon: IconName;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "mindmap",
    title: "خريطة ذهنية كلاسيكية",
    description: "فكرة مركزية وأفكار فرعية حولها",
    icon: "mindmap",
  },
  {
    id: "orgchart",
    title: "مخطط تنظيمي هرمي",
    description: "من الأعلى إلى الأسفل",
    icon: "orgchart",
  },
  {
    id: "timeline",
    title: "خط زمني",
    description: "أحداث متتابعة على خط زمني",
    icon: "timeline",
  },
  {
    id: "fishbone",
    title: "أسباب ونتائج",
    description: "مخطط عظم السمكة",
    icon: "fishbone",
  },
  {
    id: "flowchart",
    title: "مخطط تدفق",
    description: "خطوات متسلسلة",
    icon: "flowchart",
  },
];

const TOKEN = {
  accent: "#1f6f63",
  amber: "#d98c3b",
  ink: "#211f1a",
  line: "#9b937c",
};

type Variant = "accent" | "soft" | "amber";

const VARIANT_FILL: Record<Variant, string> = {
  accent: TOKEN.accent,
  soft: "#e3efec",
  amber: TOKEN.amber,
};

interface NodeOptions {
  look?: NodeObject["look"];
  shape?: NodeObject["shape"];
  fill?: string;
  bold?: boolean;
  fontSize?: number;
  name?: string;
}

/** عقدة قالب: شكل + نص مربوط ككائن واحد (بدل مستطيل ونص منفصلين). */
function node(
  text: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  variant: Variant,
  options: NodeOptions = {}
): NodeObject {
  return makeNode({
    left: cx - width / 2,
    top: cy - height / 2,
    width,
    height,
    look: options.look ?? "flat",
    shape: options.shape ?? "rounded",
    fill: options.fill ?? VARIANT_FILL[variant],
    stroke: TOKEN.accent,
    cornerRadius: 16,
    label: text,
    fontSize: options.fontSize ?? 16,
    fontWeight: options.bold ? "bold" : "normal",
    textAlign: "center",
    verticalAlign: "middle",
    meta: { name: options.name ?? "عقدة", kind: "rectangle" },
  });
}

function link(
  from: NodeObject | { x: number; y: number },
  to: NodeObject | { x: number; y: number },
  route: ConnectorObject["route"] = "straight",
  options: { arrow?: boolean; sides?: [string, string] } = {}
): ConnectorObject {
  const end = (target: NodeObject | { x: number; y: number }, side?: string) =>
    target instanceof NodeObject
      ? { node: target, side: (side as never) ?? "auto" }
      : { point: target };
  return makeConnector({
    from: end(from, options.sides?.[0]),
    to: end(to, options.sides?.[1]),
    route,
    endHead: options.arrow ? "arrow" : "none",
    stroke: TOKEN.line,
    strokeWidth: 2.5,
    meta: { name: "خط ربط", kind: "arrow" },
  });
}

export function buildTemplate(
  id: TemplateId,
  cx: number,
  cy: number
): fabric.Object[] {
  switch (id) {
    case "mindmap":
      return buildMindmap(cx, cy);
    case "orgchart":
      return buildOrgChart(cx, cy);
    case "timeline":
      return buildTimeline(cx, cy);
    case "fishbone":
      return buildFishbone(cx, cy);
    case "flowchart":
      return buildFlowchart(cx, cy);
    default:
      return [];
  }
}

function buildMindmap(cx: number, cy: number): fabric.Object[] {
  const center = node("الفكرة الرئيسية", cx, cy, 190, 76, "accent", {
    shape: "pill",
    bold: true,
    fontSize: 20,
    name: "الفكرة المركزية",
  });
  const count = 6;
  const radiusX = 300;
  const radiusY = 210;
  const children: NodeObject[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const color = NOTE_COLORS[i % NOTE_COLORS.length];
    children.push(
      node(
        `فكرة فرعية ${i + 1}`,
        cx + radiusX * Math.cos(angle),
        cy + radiusY * Math.sin(angle),
        150,
        56,
        "soft",
        { shape: "pill", fill: color.fill }
      )
    );
  }
  const links = children.map((child) => link(center, child, "curve"));
  return [...links, center, ...children];
}

function buildOrgChart(cx: number, cy: number): fabric.Object[] {
  const root = node("الإدارة العليا", cx, cy - 150, 180, 58, "accent", {
    look: "card",
    shape: "rounded",
    fill: "#ffffff",
    bold: true,
  });
  const midXs = [cx - 260, cx, cx + 260];
  const mids = midXs.map((x, i) =>
    node(`قسم ${i + 1}`, x, cy - 20, 160, 54, "soft", { look: "card", fill: "#ffffff" })
  );
  const leaves = midXs.map((x, i) =>
    node(`فريق ${i + 1}`, x, cy + 110, 150, 48, "soft", {
      look: "flat",
      fill: NOTE_COLORS[i].fill,
    })
  );
  const links = [
    ...mids.map((m) => link(root, m, "elbow", { sides: ["bottom", "top"] })),
    ...mids.map((m, i) => link(m, leaves[i], "elbow", { sides: ["bottom", "top"] })),
  ];
  return [...links, root, ...mids, ...leaves];
}

function buildTimeline(cx: number, cy: number): fabric.Object[] {
  const spineStart = cx - 340;
  const spineEnd = cx + 340;
  const count = 5;
  const step = (spineEnd - spineStart) / (count - 1);
  const objects: fabric.Object[] = [];
  const spine = makeConnector({
    from: { point: { x: spineStart - 30, y: cy } },
    to: { point: { x: spineEnd + 30, y: cy } },
    route: "straight",
    endHead: "triangle",
    stroke: TOKEN.line,
    strokeWidth: 3,
    meta: { name: "خط زمني", kind: "arrow" },
  });
  objects.push(spine);
  const nodes: NodeObject[] = [];
  for (let i = 0; i < count; i++) {
    const x = spineStart + step * i;
    const above = i % 2 === 0;
    const dot = makeNode({
      left: x - 12,
      top: cy - 12,
      width: 24,
      height: 24,
      shape: "ellipse",
      fill: TOKEN.accent,
      stroke: "#ffffff",
      strokeWidth: 3,
      meta: { name: "نقطة", kind: "circle" },
    });
    const card = node(`الحدث ${i + 1}`, x, above ? cy - 100 : cy + 100, 130, 52, "soft", {
      look: "card",
      fill: "#ffffff",
    });
    objects.push(link(dot, card, "straight", { sides: [above ? "top" : "bottom", above ? "bottom" : "top"] }));
    nodes.push(dot, card);
  }
  return [...objects, ...nodes];
}

function buildFishbone(cx: number, cy: number): fabric.Object[] {
  const spineStart = cx - 320;
  const spineEnd = cx + 200;
  const result = node("النتيجة", spineEnd + 90, cy, 150, 70, "amber", {
    shape: "pill",
    bold: true,
    fontSize: 18,
  });
  const spine = link({ x: spineStart, y: cy }, result, "straight", { arrow: true, sides: ["auto", "left"] });
  const objects: fabric.Object[] = [spine];
  const nodes: NodeObject[] = [result];
  const boneCount = 6;
  const usable = spineEnd - spineStart - 40;
  for (let i = 0; i < boneCount; i++) {
    const x = spineStart + 60 + (usable / boneCount) * i;
    const up = i % 2 === 0;
    const label = node(`سبب ${i + 1}`, x - 70, up ? cy - 130 : cy + 130, 130, 46, "soft", {
      look: "flat",
      fill: NOTE_COLORS[i % NOTE_COLORS.length].fill,
    });
    objects.push(link({ x, y: cy }, label, "straight", { sides: ["auto", up ? "bottom" : "top"] }));
    nodes.push(label);
  }
  return [...objects, ...nodes];
}

function buildFlowchart(cx: number, cy: number): fabric.Object[] {
  const gap = 100;
  const steps: { text: string; options: NodeOptions; variant: Variant; w: number; h: number }[] = [
    { text: "البداية", variant: "accent", w: 170, h: 50, options: { shape: "pill", bold: true } },
    { text: "الخطوة 2", variant: "soft", w: 180, h: 54, options: { look: "card", fill: "#ffffff" } },
    { text: "قرار؟", variant: "amber", w: 170, h: 100, options: { look: "plain", shape: "diamond", fill: "#fbe3c8" } },
    { text: "الخطوة 4", variant: "soft", w: 180, h: 54, options: { look: "card", fill: "#ffffff" } },
    { text: "النهاية", variant: "amber", w: 170, h: 50, options: { shape: "pill", bold: true } },
  ];
  const startY = cy - ((steps.length - 1) * (gap + 8)) / 2;
  const nodes = steps.map((step, i) =>
    node(step.text, cx, startY + i * (gap + 8), step.w, step.h, step.variant, step.options)
  );
  const links = nodes.slice(0, -1).map((n, i) => link(n, nodes[i + 1], "straight", { arrow: true, sides: ["bottom", "top"] }));
  return [...links, ...nodes];
}
