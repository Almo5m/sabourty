import * as fabric from "fabric";
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
  accentSoft: "#e3efec",
  amber: "#d98c3b",
  ink: "#211f1a",
  paper: "#faf9f5",
  line: "#c8c1af",
};

type Variant = "accent" | "soft" | "amber";

const VARIANT_STYLE: Record<Variant, { fill: string; text: string }> = {
  accent: { fill: TOKEN.accent, text: TOKEN.paper },
  soft: { fill: TOKEN.accentSoft, text: TOKEN.ink },
  amber: { fill: TOKEN.amber, text: TOKEN.paper },
};

function tagObject(obj: fabric.Object, name: string) {
  const anyObj = obj as fabric.Object & { id?: string; name?: string };
  anyObj.id = crypto.randomUUID();
  anyObj.name = name;
}

/**
 * عقدة = مستطيل + نص، ككائنين مستقلّين على مستوى اللوحة (بدون تجميع Group)
 * حتى تبقى الكتابة داخل النص تعمل بشكل طبيعي عبر آلية فابريك الأصلية
 * للنقر المزدوج على النص (وهي آلية لا تعمل مع نص متداخل داخل مجموعة).
 */
function createNode(
  text: string,
  left: number,
  top: number,
  width: number,
  height: number,
  variant: Variant,
  name = "عقدة"
): [fabric.Rect, fabric.Textbox] {
  const style = VARIANT_STYLE[variant];
  const rect = new fabric.Rect({
    left,
    top,
    width,
    height,
    fill: style.fill,
    rx: 14,
    ry: 14,
    stroke: "rgba(33, 31, 26, 0.06)",
    strokeWidth: 1,
    shadow: new fabric.Shadow({
      color: "rgba(33, 31, 26, 0.12)",
      blur: 7,
      offsetY: 2,
    }),
  });
  const textbox = new fabric.Textbox(text, {
    left: left + 10,
    top: top + height / 2 - 10,
    width: width - 20,
    fontSize: 14,
    fill: style.text,
    textAlign: "center",
  });
  tagObject(rect, name);
  tagObject(textbox, `${name} (نص)`);
  return [rect, textbox];
}

function createCircle(x: number, y: number, radius: number, variant: Variant) {
  const style = VARIANT_STYLE[variant];
  const circle = new fabric.Circle({
    left: x - radius,
    top: y - radius,
    radius,
    fill: style.fill,
    stroke: TOKEN.paper,
    strokeWidth: 2,
  });
  tagObject(circle, "نقطة");
  return circle;
}

function createLine(x1: number, y1: number, x2: number, y2: number) {
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: TOKEN.line,
    strokeWidth: 2,
  });
  tagObject(line, "خط ربط");
  return line;
}

/** منحنى رابط ناعم (بدل خط مستقيم) — يُستخدم في الخريطة الذهنية الكلاسيكية. */
function createCurve(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const path = new fabric.Path(
    `M ${x1} ${y1} Q ${midX} ${y1} ${midX} ${midY} Q ${midX} ${y2} ${x2} ${y2}`,
    {
      stroke: TOKEN.line,
      strokeWidth: 2,
      fill: "",
    }
  );
  tagObject(path, "خط ربط");
  return path;
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
  const objects: fabric.Object[] = [];
  const count = 6;
  const radius = 220;
  const subNodes: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    subNodes.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  subNodes.forEach((p) => {
    objects.push(createCurve(cx, cy, p.x, p.y));
  });
  objects.push(
    ...createNode(
      "الفكرة الرئيسية",
      cx - 75,
      cy - 30,
      150,
      60,
      "accent",
      "الفكرة المركزية"
    )
  );
  subNodes.forEach((p, i) => {
    objects.push(
      ...createNode(`فكرة فرعية ${i + 1}`, p.x - 60, p.y - 25, 120, 50, "soft")
    );
  });

  return objects;
}

function buildOrgChart(cx: number, cy: number): fabric.Object[] {
  const objects: fabric.Object[] = [];
  const rootTop = cy - 170;
  const root = { left: cx - 75, top: rootTop, w: 150, h: 50 };

  const midY = cy - 60;
  const midXs = [cx - 260, cx - 75, cx + 110];
  const midW = 150;
  const midH = 50;

  const leafY = cy + 50;
  const leafW = 140;
  const leafH = 46;

  midXs.forEach((mx) => {
    objects.push(createLine(cx, rootTop + root.h, mx + midW / 2, midY));
  });
  midXs.forEach((mx) => {
    objects.push(createLine(mx + midW / 2, midY + midH, mx + midW / 2, leafY));
  });

  objects.push(
    ...createNode("الإدارة العليا", root.left, root.top, root.w, root.h, "accent")
  );
  midXs.forEach((mx, i) => {
    objects.push(...createNode(`قسم ${i + 1}`, mx, midY, midW, midH, "soft"));
  });
  midXs.forEach((mx, i) => {
    objects.push(
      ...createNode(
        `فريق ${i + 1}`,
        mx + midW / 2 - leafW / 2,
        leafY,
        leafW,
        leafH,
        "soft"
      )
    );
  });

  return objects;
}

function buildTimeline(cx: number, cy: number): fabric.Object[] {
  const objects: fabric.Object[] = [];
  const spineStart = cx - 320;
  const spineEnd = cx + 320;
  const count = 5;
  const step = (spineEnd - spineStart) / (count - 1);
  const nodeW = 120;
  const nodeH = 44;

  objects.push(createLine(spineStart, cy, spineEnd, cy));

  for (let i = 0; i < count; i++) {
    const x = spineStart + step * i;
    const above = i % 2 === 0;
    const labelY = above ? cy - 90 : cy + 46;
    objects.push(createLine(x, cy, x, above ? cy - 44 : cy + 44));
    objects.push(createCircle(x, cy, 9, "accent"));
    objects.push(
      ...createNode(`الحدث ${i + 1}`, x - nodeW / 2, labelY, nodeW, nodeH, "soft")
    );
  }

  return objects;
}

function buildFishbone(cx: number, cy: number): fabric.Object[] {
  const objects: fabric.Object[] = [];
  const spineStart = cx - 300;
  const resultW = 150;
  const resultH = 60;
  const spineEnd = cx + 220;

  objects.push(createLine(spineStart, cy, spineEnd, cy));
  objects.push(
    ...createNode("النتيجة", spineEnd, cy - resultH / 2, resultW, resultH, "amber")
  );

  const boneCount = 6;
  const usableLength = spineEnd - spineStart - 40;
  const labelW = 130;
  const labelH = 40;

  for (let i = 0; i < boneCount; i++) {
    const x = spineStart + 40 + (usableLength / (boneCount + 1)) * (i + 1);
    const up = i % 2 === 0;
    const targetY = up ? cy - 95 : cy + 95;
    const targetX = x - 60;

    objects.push(createLine(x, cy, targetX, targetY));
    objects.push(
      ...createNode(
        `سبب ${i + 1}`,
        targetX - labelW / 2,
        up ? targetY - labelH - 4 : targetY + 4,
        labelW,
        labelH,
        "soft"
      )
    );
  }

  return objects;
}

function buildFlowchart(cx: number, cy: number): fabric.Object[] {
  const objects: fabric.Object[] = [];
  const steps = ["البداية", "الخطوة 2", "الخطوة 3", "الخطوة 4", "النهاية"];
  const nodeW = 180;
  const nodeH = 50;
  const gap = 90;
  const startY = cy - ((steps.length - 1) * gap) / 2 - nodeH / 2;

  const variants: Variant[] = ["accent", "soft", "soft", "soft", "amber"];

  const positions = steps.map((_, i) => ({
    left: cx - nodeW / 2,
    top: startY + i * gap,
  }));

  for (let i = 0; i < positions.length - 1; i++) {
    const y1 = positions[i].top + nodeH;
    const y2 = positions[i + 1].top;
    objects.push(createLine(cx, y1, cx, y2));
  }

  steps.forEach((label, i) => {
    objects.push(
      ...createNode(label, positions[i].left, positions[i].top, nodeW, nodeH, variants[i])
    );
  });

  return objects;
}
