"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as fabric from "fabric";
import { Icon, IconName } from "@/features/shared/icons/Icon";
import {
  HIGHLIGHTER_DEFAULTS,
  INK_DEFAULTS,
  LayerItem,
  SettingsGroup,
  settingsGroupOf,
  ToolSettings,
  ToolType,
  VoiceNoteMeta,
} from "../types";
import { useCanvasHistory } from "../hooks/useCanvasHistory";
import { Toolbar } from "./Toolbar";
import { LayersPanel } from "./LayersPanel";
import { PageNavigator } from "./PageNavigator";
import { ZoomControl } from "./ZoomControl";
import { VoiceRecorderModal } from "./VoiceRecorderModal";
import { VoiceNotesPanel } from "./VoiceNotesPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import { VideoExportModal } from "./VideoExportModal";
import { CanvasSettingsPanel } from "./CanvasSettingsPanel";
import { saveBoard } from "@/features/boards/lib/boardStorage";
import { BoardData, BoardMode, PdfPageState } from "@/features/boards/types";
import { exportPagesAsPdf, importPdfPages, PdfImportError } from "../lib/pdf";
import {
  deleteBoardPageImages,
  PageImageCache,
  savePageImages,
} from "../lib/pageImageStorage";
import {
  clampZoom,
  constrainViewportToPage,
  exportSceneRect,
  fitPageToCanvas,
  ViewInsets,
} from "../lib/viewport";
import { colorWithAlpha } from "../lib/color";
import { readImageAsDataUrl } from "../lib/image";
import {
  DEFAULT_NOTE_STYLE,
  DiagramController,
  InspectorModel,
  NoteStyle,
} from "../objects/controller";
import { InspectorBar } from "./inspector/InspectorBar";
import { isConnector } from "../objects/connector";
import { isNode } from "../objects/node";
import { flattenObjects, syncConnectors } from "../objects/sync";
import { loadFont } from "../lib/fonts";
import { buildTemplate, TEMPLATES, TemplateId } from "../lib/templates";
import {
  applyCanvasAppearance,
  CanvasSettings,
  isDarkColor,
  normalizeSettings,
  stripBackground,
} from "../lib/canvasAppearance";
import { CompositeStream, createCompositeStream } from "../lib/compositeStream";
import { playSessionReplay, SessionStep } from "../lib/replay";
import {
  downloadBlob,
  MAX_VIDEO_SECONDS,
  pickVideoMimeType,
  videoFileExtension,
} from "../lib/video";
import {
  deleteAudioBlob,
  getAudioBlob,
  saveAudioBlob,
} from "../lib/audioStorage";

// نسخة فابريك 7 تجعل نقطة أصل الأشكال "المنتصف" افتراضيًا. كل منطق الرسم هنا
// مبني على أن (left, top) هو الركن العلوي، فنضبطها هنا مرة واحدة لكل الأشكال.
// ملاحظة: لازم نعدّل الكائن في مكانه (Object.assign) — استبداله لا يؤثر.
// ونفس المكان يضبط هوية عناصر التحديد (لون العلامة بدل الأزرق الافتراضي).
Object.assign(fabric.FabricObject.ownDefaults, {
  originX: "left",
  originY: "top",
  borderColor: "#1f6f63",
  cornerColor: "#1f6f63",
  cornerStrokeColor: "#ffffff",
  cornerStyle: "circle",
  cornerSize: 10,
  transparentCorners: false,
  borderScaleFactor: 1.5,
  padding: 4,
});

/** مساحة محجوزة حوالين صفحة PDF عشان الأشرطة العائمة (فوق/تحت) ما تغطيش عليها. */
const PDF_VIEW_INSETS: ViewInsets = { top: 76, bottom: 76, side: 12 };

/** عرض سن الفرشاة لكل أداة رسم حر، من قيمة "الحجم" في شريط الخصائص. */
function brushWidthFor(tool: ToolType, size: number): number {
  if (tool === "highlighter") return Math.max(14, size * 2);
  if (tool === "spray") return Math.max(10, size * 2);
  return size;
}

/** يضبط صورة خلفية PDF لتغطي الصفحة بالضبط مهما كانت دقة الصورة المرسومة. */
function fitBackgroundToPage(
  img: fabric.FabricImage,
  page: { width: number; height: number }
) {
  img.set({
    left: 0,
    top: 0,
    scaleX: page.width / (img.width || page.width),
    scaleY: page.height / (img.height || page.height),
  });
}

const EXTRA_PROPS = [
  "id",
  "name",
  "locked",
  "kind",
  "groupTag",
  "groupLabel",
  "groupIcon",
  "groupedByUser",
  "audioNoteId",
  "audioDurationSeconds",
  "audioRecordedAt",
];

/** لقطة JSON للوحة بدون الخلفية (الخلفية بتتحفظ في إعدادات اللوحة وبتتطبق تاني بعد كل تحميل). */
function serializeCanvas(canvas: fabric.Canvas) {
  return stripBackground(canvas.toObject(EXTRA_PROPS) as Record<string, unknown>);
}

interface WhiteboardCanvasProps {
  board: BoardData;
}

function shapeName(tool: ToolType) {
  const map: Record<string, string> = {
    rectangle: "مستطيل",
    rounded: "مستطيل مدوّر",
    pill: "كبسولة",
    diamond: "معيّن",
    hexagon: "سداسي",
    parallelogram: "متوازي أضلاع",
    elbow: "سهم متعرّج",
    curve: "سهم منحني",
    circle: "دائرة",
    triangle: "مثلث",
    line: "خط",
    arrow: "سهم",
    star: "نجمة",
    text: "نص",
    sticky: "ملاحظة",
    pen: "رسمة",
    spray: "رشّ",
    highlighter: "هايلايتر",
  };
  return map[tool] ?? "عنصر";
}

// نفس أسماء الأدوات تُستخدم كأيقونة الطبقة في لوحة الطبقات
const KIND_MAP: Record<ToolType, IconName> = {
  select: "select",
  hand: "hand",
  pen: "pen",
  spray: "spray",
  highlighter: "highlighter",
  eraser: "eraser",
  text: "text",
  sticky: "sticky",
  voice: "voice",
  rectangle: "rectangle",
  rounded: "rectangle",
  pill: "rectangle",
  diamond: "shapes",
  hexagon: "shapes",
  parallelogram: "shapes",
  elbow: "arrow",
  curve: "arrow",
  circle: "circle",
  triangle: "triangle",
  line: "line",
  arrow: "arrow",
  star: "star",
};

/** يستخرج إحداثيات المؤشر من حدث فأرة أو لمس. */
function getClientXY(e: Event): { x: number; y: number } {
  const touchEvent = e as unknown as TouchEvent;
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  const mouseEvent = e as MouseEvent;
  return { x: mouseEvent.clientX, y: mouseEvent.clientY };
}

/** عناصر محمية من الممحاة: الملاحظات الصوتية، الملاحظات اللاصقة، وكل عناصر القوالب. */
function isEraseProtected(obj: fabric.Object): boolean {
  const anyObj = obj as fabric.Object & {
    kind?: IconName;
    groupTag?: string;
    audioNoteId?: string;
  };
  return (
    Boolean(anyObj.groupTag) ||
    Boolean(anyObj.audioNoteId) ||
    anyObj.kind === "voice" ||
    anyObj.kind === "sticky" ||
    isNode(obj) ||
    isConnector(obj)
  );
}

/** يحوّل تحديدًا متعددًا (ActiveSelection) إلى مجموعة دائمة واحدة، ويعيد المجموعة الجديدة. */
function groupActiveSelection(canvas: fabric.Canvas): fabric.Group | null {
  const active = canvas.getActiveObject();
  if (!active || active.type !== "activeselection") return null;
  const objects = [...(active as fabric.ActiveSelection).getObjects()];
  canvas.discardActiveObject();
  objects.forEach((obj) => canvas.remove(obj));
  const group = new fabric.Group(objects, {});
  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.requestRenderAll();
  return group;
}

/** يفكّ مجموعة أنشأها المستخدم يدويًا، ويعيد كل عنصر لموضعه الصحيح على اللوحة. */
function ungroupSelection(canvas: fabric.Canvas) {
  const active = canvas.getActiveObject();
  if (!active || active.type !== "group") return;
  const group = active as fabric.Group;
  const objects = [...group.getObjects()];
  canvas.discardActiveObject();
  objects.forEach((obj) => {
    group.remove(obj);
    canvas.add(obj);
  });
  canvas.remove(group);
  canvas.requestRenderAll();
}

/** يصعد سلسلة المجموعات الأصل لإيجاد أقرب عنصر له معرّف طبقة. */
/** يحدد معرّف الطبقة الذي يجب تمييزه في لوحة الطبقات عن عنصر محدَّد (مفرد أو متعدد). */
function resolveLayerId(obj: fabric.Object | null | undefined): string | null {
  type Tagged = fabric.Object & {
    id?: string;
    group?: fabric.Object;
    groupTag?: string;
  };

  if (!obj) return null;

  if (obj.type === "activeselection") {
    const members = (obj as fabric.ActiveSelection).getObjects() as Tagged[];
    const tags = new Set(members.map((m) => m.groupTag).filter(Boolean));
    if (tags.size === 1) return [...tags][0] as string;
    return null;
  }

  let current: Tagged | null | undefined = obj as Tagged;
  while (current) {
    if (current.groupTag) return current.groupTag;
    if (current.id) return current.id;
    current = current.group as Tagged | undefined;
  }
  return null;
}

/** يعيد كل الكائنات المرتبطة بمعرّف طبقة: أعضاء مجموعة وهمية (groupTag) أو كائن واحد. */
function getLayerObjects(canvas: fabric.Canvas, id: string): fabric.Object[] {
  type Tagged = fabric.Object & { id?: string; groupTag?: string };
  const all = canvas.getObjects() as Tagged[];
  const grouped = all.filter((o) => o.groupTag === id);
  if (grouped.length > 0) return grouped;
  const single = all.find((o) => o.id === id);
  return single ? [single] : [];
}

/** يرسم صفحة PDF (الصورة + الرسومات) بعيدًا عن الشاشة، لتصديرها بدون ما نتنقل لها. */
async function renderPageOffscreen(
  page: PdfPageState,
  imageUrl: string | null
): Promise<string> {
  const el = document.createElement("canvas");
  const staticCanvas = new fabric.StaticCanvas(el, {
    width: page.width,
    height: page.height,
  });
  try {
    if (page.json) {
      await staticCanvas.loadFromJSON(page.json as Record<string, unknown>);
    }
    // الخطوط المستخدمة في الصفحة لازم تتحمّل قبل الرسم، والروابط محتاجة تتحسب هندستها
    const used = new Set<string>();
    for (const obj of flattenObjects(staticCanvas.getObjects())) {
      if (isNode(obj) || obj instanceof fabric.Textbox) used.add(obj.fontFamily);
    }
    await Promise.all([...used].map((family) => loadFont(family)));
    for (const obj of flattenObjects(staticCanvas.getObjects())) {
      if (isNode(obj)) obj.invalidateText();
      else if (obj instanceof fabric.Textbox) obj.initDimensions();
    }
    syncConnectors(staticCanvas.getObjects());
    staticCanvas.backgroundColor = "#ffffff";
    if (imageUrl) {
      const img = await fabric.FabricImage.fromURL(imageUrl);
      fitBackgroundToPage(img, page);
      staticCanvas.backgroundImage = img;
    }
    staticCanvas.renderAll();
    return staticCanvas.toDataURL({
      format: "jpeg",
      quality: 0.92,
      multiplier: pageExportMultiplier(page),
    });
  } finally {
    staticCanvas.dispose();
    el.width = 0;
    el.height = 0;
  }
}

/** معامل التكبير عند تصدير صفحة: نفس دقة الصورة المرسومة تقريبًا، بحد أقصى 3x. */
function pageExportMultiplier(page: { width: number; height: number }): number {
  return Math.min(3, 2200 / Math.max(page.width, page.height));
}

export function WhiteboardCanvas({ board }: WhiteboardCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const history = useCanvasHistory();

  const [activeTool, setActiveTool] = useState<ToolType>("pen");
  const [settings, setSettings] = useState<ToolSettings>(INK_DEFAULTS);
  // الهايلايتر ليه لون/حجم/شفافية مستقلين، وباقي الأدوات بتشارك إعدادات الحبر
  const settingsMemoryRef = useRef<Record<SettingsGroup, ToolSettings>>({
    ink: INK_DEFAULTS,
    highlighter: HIGHLIGHTER_DEFAULTS,
  });
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings>(() =>
    normalizeSettings(board.settings)
  );
  const canvasSettingsRef = useRef(canvasSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectionKind, setSelectionKind] = useState<
    "none" | "object" | "multi" | "userGroup"
  >("none");
  const [voiceNotes, setVoiceNotes] = useState<VoiceNoteMeta[]>([]);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [voiceNotesPanelOpen, setVoiceNotesPanelOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // على الشاشات الصغيرة لوحة الطبقات بتغطي اللوحة، فبتبدأ مقفولة
  const [layersOpen, setLayersOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const [eraserCursor, setEraserCursor] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });
  const isErasingRef = useRef(false);
  const erasedAnyRef = useRef(false);
  const [pdfBusy, setPdfBusy] = useState<{
    kind: "import" | "export";
    done: number;
    total: number;
  } | null>(null);
  const pageSwitchingRef = useRef(false);
  const diagramRef = useRef<DiagramController | null>(null);
  const [noteStyle, setNoteStyle] = useState<NoteStyle>(DEFAULT_NOTE_STYLE);
  // لقطة خصائص العنصر المختار (لوحة الخصائص) + المتحكّم نفسه عشان الواجهة تكلّمه
  const [inspector, setInspector] = useState<InspectorModel | null>(null);
  const [diagramController, setDiagramController] =
    useState<DiagramController | null>(null);
  const keyActionsRef = useRef<{
    goToPage: (index: number) => Promise<void>;
    zoomBy: (factor: number) => void;
    resetZoom: () => void;
  }>({ goToPage: async () => {}, zoomBy: () => {}, resetZoom: () => {} });
  const [saveFailed, setSaveFailed] = useState(false);

  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoStatus, setVideoStatus] = useState<
    "idle" | "recording" | "replaying" | "recorded"
  >("idle");
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const sessionStepsRef = useRef<SessionStep[]>([]);
  const [sessionStepsCount, setSessionStepsCount] = useState(0);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoBlobRef = useRef<Blob | null>(null);
  const videoMimeTypeRef = useRef<string>("");
  const videoMicStreamRef = useRef<MediaStream | null>(null);
  const videoCompositeRef = useRef<CompositeStream | null>(null);
  const [videoNoAudio, setVideoNoAudio] = useState(false);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoMaxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const videoCancelReplayRef = useRef(false);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const rerecordTargetRef = useRef<string | null>(null);

  const [mode, setMode] = useState<BoardMode>(board.mode);
  const [pages, setPages] = useState<PdfPageState[]>(board.pdfPages);
  const [currentPageIndex, setCurrentPageIndex] = useState(
    board.currentPageIndex
  );

  const activeToolRef = useRef(activeTool);
  const settingsRef = useRef(settings);
  const modeRef = useRef(mode);
  const pagesRef = useRef(pages);
  const currentPageIndexRef = useRef(currentPageIndex);
  const pageImagesRef = useRef<PageImageCache | null>(null);
  const pageBackgroundRef = useRef<fabric.FabricObject | null>(null);
  /** true لو المستخدم كبّر/حرّك العرض بنفسه (فمبنعيدش ملاءمة الصفحة تلقائيًا عند تغيير حجم الشاشة) */
  const viewIsManualRef = useRef(false);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    settingsRef.current = settings;
    // الأشكال والروابط الجديدة بتاخد لون وسُمك وشفافية الأداة الحالية
    diagramRef.current?.setToolContext({
      shape: {
        stroke: settings.color,
        strokeWidth: Math.max(1, Math.round(settings.size / 2)),
        opacity: settings.opacity,
      },
      note: noteStyle,
    });
  }, [settings, noteStyle]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  const applyAppearance = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      applyCanvasAppearance(canvas, canvasSettingsRef.current, {
        hasObjects: canvas.getObjects().length > 0,
        pdf: modeRef.current === "pdf",
      });
      // loadFromJSON و clear بيمسحوا صورة الصفحة، فنرجّعها بعد أي تحميل
      const pageBackground = pageBackgroundRef.current;
      if (
        modeRef.current === "pdf" &&
        pageBackground &&
        canvas.backgroundImage !== pageBackground
      ) {
        canvas.backgroundImage = pageBackground;
        canvas.requestRenderAll();
      }
    },
    []
  );

  const getPageImages = useMemo(
    () => () => {
      if (!pageImagesRef.current) {
        pageImagesRef.current = new PageImageCache(board.id);
      }
      return pageImagesRef.current;
    },
    [board.id]
  );

  /** أبعاد صفحة الـ PDF الحالية (بوحدات المشهد)، أو null في وضع اللوحة الحرة. */
  const currentPageRect = useMemo(
    () => () => {
      if (modeRef.current !== "pdf") return null;
      const page = pagesRef.current[currentPageIndexRef.current];
      return page ? { width: page.width, height: page.height } : null;
    },
    []
  );

  /** يضبط الصفحة الحالية بحجم الشاشة (ملاءمة كاملة) ويصفّر وضع التحكم اليدوي. */
  const fitCurrentPage = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      const rect = currentPageRect();
      if (!canvas || !rect) return;
      viewIsManualRef.current = false;
      setZoom(fitPageToCanvas(canvas, rect, PDF_VIEW_INSETS));
    },
    [currentPageRect]
  );

  /** يمنع الصفحة من الضياع خارج الشاشة أثناء التحريك/التكبير. */
  const constrainView = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      const rect = currentPageRect();
      if (!canvas || !rect) return;
      constrainViewportToPage(canvas, rect, PDF_VIEW_INSETS);
      canvas.requestRenderAll();
    },
    [currentPageRect]
  );

  /** عند تغيير حجم النافذة: لو المستخدم ما تدخّلش يدويًا نعيد ملاءمة الصفحة. */
  const refitPdfView = useMemo(
    () => () => {
      if (modeRef.current !== "pdf") return;
      if (viewIsManualRef.current) constrainView();
      else fitCurrentPage();
    },
    [constrainView, fitCurrentPage]
  );

  /** يحمّل صورة صفحة الـ PDF من IndexedDB ويثبّتها كخلفية للكانفا. */
  const loadPageBackground = useMemo(
    () => async (index: number) => {
      const canvas = fabricRef.current;
      const page = pagesRef.current[index];
      if (!canvas || !page) return;

      let background: fabric.FabricObject;
      const url = await getPageImages().urlFor(index);
      if (url) {
        const img = await fabric.FabricImage.fromURL(url);
        fitBackgroundToPage(img, page);
        background = img;
      } else {
        // صفحة بدون صورة (مثلًا جاية من السحابة): ورقة بيضا بنفس المقاس
        background = new fabric.Rect({
          left: 0,
          top: 0,
          width: page.width,
          height: page.height,
          fill: "#ffffff",
        });
      }
      background.shadow = new fabric.Shadow({
        color: "rgba(33, 31, 26, 0.28)",
        blur: 18,
        offsetX: 0,
        offsetY: 4,
      });
      pageBackgroundRef.current = background;
      canvas.backgroundImage = background;
    },
    [getPageImages]
  );

  const markViewManual = () => {
    viewIsManualRef.current = true;
  };

  const refreshLayers = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      // أي لوحة اتحمّلت لازم خطوطها (جوجل) تتحمّل عشان النص يظهر بشكله الصحيح
      void diagramRef.current?.ensureBoardFonts();

      type Tagged = fabric.Object & {
        id?: string;
        name?: string;
        locked?: boolean;
        kind?: IconName;
        groupTag?: string;
        groupLabel?: string;
        groupIcon?: IconName;
      };

      const byId = new Map<string, LayerItem>();
      const order: string[] = [];

      canvas.getObjects().forEach((raw) => {
        const obj = raw as Tagged;

        if (obj.groupTag) {
          const key = obj.groupTag;
          const existing = byId.get(key);
          if (!existing) {
            byId.set(key, {
              id: key,
              name: obj.groupLabel ?? "مجموعة",
              type: "group",
              icon: obj.groupIcon ?? "templates",
              visible: obj.visible !== false,
              locked: Boolean(obj.locked),
            });
            order.push(key);
          } else {
            if (obj.visible !== false) existing.visible = true;
            if (!obj.locked) existing.locked = false;
          }
          return;
        }

        const key = obj.id ?? crypto.randomUUID();
        byId.set(key, {
          id: key,
          name: obj.name ?? "عنصر",
          type: obj.type ?? "object",
          icon: obj.kind ?? "select",
          visible: obj.visible !== false,
          locked: Boolean(obj.locked),
        });
        order.push(key);
      });

      setLayers(order.map((id) => byId.get(id) as LayerItem));
      // الشبكة التلقائية بتعتمد على وجود عناصر، ولازم تتطبق تاني بعد أي تحميل
      applyAppearance();
    },
    [applyAppearance]
  );

  const refreshVoiceNotes = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const notes: VoiceNoteMeta[] = canvas
        .getObjects()
        .filter(
          (obj) =>
            (obj as fabric.Object & { audioNoteId?: string }).audioNoteId
        )
        .map((obj) => {
          const anyObj = obj as fabric.Object & {
            id?: string;
            name?: string;
            audioNoteId?: string;
            audioDurationSeconds?: number;
            audioRecordedAt?: string;
          };
          return {
            objectId: anyObj.id ?? "",
            audioNoteId: anyObj.audioNoteId ?? "",
            name: anyObj.name ?? "ملاحظة صوتية",
            durationSeconds: anyObj.audioDurationSeconds ?? 0,
            recordedAt: anyObj.audioRecordedAt ?? new Date().toISOString(),
          };
        });
      setVoiceNotes(notes);
    },
    []
  );

  const persist = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const pageRect = currentPageRect();
      const thumbnail = pageRect
        ? exportSceneRect(canvas, pageRect, {
            format: "jpeg",
            quality: 0.7,
            multiplier: 240 / pageRect.width,
          })
        : canvas.toDataURL({ format: "png", multiplier: 0.25 });

      const saved =
        modeRef.current === "pdf"
          ? saveBoard(
              board.id,
              {
                mode: "pdf",
                pdfPages: pagesRef.current,
                currentPageIndex: currentPageIndexRef.current,
                settings: canvasSettingsRef.current,
              },
              thumbnail
            )
          : saveBoard(
              board.id,
              {
                mode: "freeform",
                canvasJSON: serializeCanvas(canvas),
                settings: canvasSettingsRef.current,
              },
              thumbnail
            );
      setSaveFailed(!saved);
    },
    [board.id, currentPageRect]
  );

  const snapshot = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const json = serializeCanvas(canvas);
      if (modeRef.current === "pdf") {
        const next = [...pagesRef.current];
        next[currentPageIndexRef.current] = {
          ...next[currentPageIndexRef.current],
          json,
        };
        pagesRef.current = next;
        setPages(next);
      }
      history.push(JSON.stringify(json));
      sessionStepsRef.current.push({
        json,
        t: Date.now(),
        pageIndex: currentPageIndexRef.current,
        width: canvas.getWidth(),
        height: canvas.getHeight(),
      });
      setSessionStepsCount(sessionStepsRef.current.length);
      refreshLayers();
      refreshVoiceNotes();
      persist();
    },
    [history, refreshLayers, refreshVoiceNotes, persist]
  );

  // Initialize canvas
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: "#ffffff",
      selection: true,
    });
    fabricRef.current = canvas;
    applyAppearance();
    if (process.env.NEXT_PUBLIC_E2E === "1") {
      // خطاف تشخيص للاختبارات الآلية فقط (غير موجود في بناء الإنتاج العادي)
      (window as unknown as { __canvas?: fabric.Canvas }).__canvas = canvas;
    }

    canvas.selectionColor = "rgba(31, 111, 99, 0.08)";
    canvas.selectionBorderColor = "#1f6f63";
    canvas.selectionLineWidth = 1.5;

    const resize = () => {
      const el = containerRef.current;
      if (!el) return;
      canvas.setDimensions({ width: el.clientWidth, height: el.clientHeight });
      refitPdfView();
      canvas.renderAll();
    };
    resize();
    window.addEventListener("resize", resize);
    let disposed = false;

    if (board.mode === "pdf" && board.pdfPages.length > 0) {
      const index = Math.min(
        Math.max(board.currentPageIndex, 0),
        board.pdfPages.length - 1
      );
      currentPageIndexRef.current = index;
      const page = board.pdfPages[index];
      void (async () => {
        try {
          if (page.json) {
            await canvas.loadFromJSON(page.json as Record<string, unknown>);
          }
          await loadPageBackground(index);
        } catch (error) {
          console.error("[pdf] تعذّر فتح الصفحة", error);
        }
        if (disposed) return;
        fitCurrentPage();
        canvas.renderAll();
        refreshLayers();
        refreshVoiceNotes();
        history.push(JSON.stringify(serializeCanvas(canvas)));
      })();
    } else if (board.canvasJSON) {
      canvas
        .loadFromJSON(board.canvasJSON as Record<string, unknown>)
        .then(() => {
          if (disposed) return;
          canvas.renderAll();
          refreshLayers();
          refreshVoiceNotes();
          history.push(JSON.stringify(serializeCanvas(canvas)));
        })
        .catch(() => {});
    } else {
      history.push(JSON.stringify(serializeCanvas(canvas)));
    }

    const diagram = new DiagramController(canvas, {
      onCommit: () => snapshot(),
      onSelectionChange: setInspector,
      onEditingChange: () => {},
      getTool: () => activeToolRef.current,
    });
    diagramRef.current = diagram;
    setDiagramController(diagram);
    let panOrigin: { x: number; y: number } | null = null;

    const assignMeta = (obj: fabric.Object, tool: ToolType) => {
      const anyObj = obj as fabric.Object & {
        id?: string;
        name?: string;
        kind?: IconName;
      };
      anyObj.id = crypto.randomUUID();
      anyObj.name = shapeName(tool);
      anyObj.kind = KIND_MAP[tool];
    };

    const eraseAtPoint = (pointer: fabric.Point) => {
      const objects = canvas.getObjects();
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (isEraseProtected(obj)) continue;
        if (obj.containsPoint(pointer)) {
          canvas.remove(obj);
          erasedAnyRef.current = true;
          canvas.requestRenderAll();
          break;
        }
      }
    };

    const updateEraserCursor = (e: fabric.TPointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { x, y } = getClientXY(e as unknown as Event);
      setEraserCursor({ x: x - rect.left, y: y - rect.top, visible: true });
    };

    const hideEraserCursor = () => {
      setEraserCursor((c) => ({ ...c, visible: false }));
    };

    const onMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      const tool = activeToolRef.current;
      const s = settingsRef.current;
      const pointer = canvas.getScenePoint(opt.e);

      if (tool === "hand") {
        panOrigin = getClientXY(opt.e);
        return;
      }

      if (tool === "eraser") {
        isErasingRef.current = true;
        erasedAnyRef.current = false;
        eraseAtPoint(pointer);
        updateEraserCursor(opt.e);
        return;
      }

      if (tool === "text") {
        const textbox = new fabric.Textbox("اكتب هنا", {
          left: pointer.x,
          top: pointer.y,
          fontSize: Math.max(16, s.size * 4),
          fill: s.color,
          opacity: s.opacity,
          width: 200,
        });
        assignMeta(textbox, "text");
        canvas.add(textbox);
        canvas.setActiveObject(textbox);
        textbox.enterEditing();
        snapshot();
        setActiveTool("select");
        return;
      }

      if (diagram.pointerDown(tool, { x: pointer.x, y: pointer.y })) return;

      if (tool === "voice") {
        pendingPointRef.current = { x: pointer.x, y: pointer.y };
        rerecordTargetRef.current = null;
        setRecorderOpen(true);
        return;
      }
    };

    const onMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (panOrigin) {
        const point = getClientXY(opt.e);
        canvas.relativePan(
          new fabric.Point(point.x - panOrigin.x, point.y - panOrigin.y)
        );
        panOrigin = point;
        markViewManual();
        constrainView();
        return;
      }

      if (activeToolRef.current === "eraser") {
        updateEraserCursor(opt.e);
        if (isErasingRef.current) {
          eraseAtPoint(canvas.getScenePoint(opt.e));
        }
        return;
      }

      const scenePoint = canvas.getScenePoint(opt.e);
      diagram.pointerMove({ x: scenePoint.x, y: scenePoint.y });
    };

    const onMouseUp = () => {
      if (panOrigin) {
        panOrigin = null;
        return;
      }
      if (isErasingRef.current) {
        isErasingRef.current = false;
        hideEraserCursor();
        if (erasedAnyRef.current) {
          erasedAnyRef.current = false;
          snapshot();
        }
        return;
      }
      if (diagram.pointerUp()) setActiveTool("select");
    };

    const onPathCreated = (e: { path: fabric.Path }) => {
      const tool = activeToolRef.current;
      assignMeta(e.path, tool);
      if (tool === "highlighter") {
        // "multiply" بيخلي النص اللي تحت التظليل يفضل واضح. على خلفية داكنة
        // بيبوّظ النتيجة (داكن × لون = داكن) فبنسيبه عادي.
        const onDarkBoard =
          modeRef.current !== "pdf" &&
          isDarkColor(canvasSettingsRef.current.background);
        e.path.set({
          globalCompositeOperation: onDarkBoard ? "source-over" : "multiply",
        });
      }
      snapshot();
    };

    const onObjectModified = () => snapshot();

    const onDoubleClick = (
      opt: fabric.TPointerEventInfo<fabric.TPointerEvent>
    ) => {
      const pointer = canvas.getScenePoint(opt.e);
      const objects = canvas.getObjects();

      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i] as fabric.Object & { audioNoteId?: string };
        if (obj.audioNoteId && obj.containsPoint(pointer)) {
          getAudioBlob(obj.audioNoteId).then((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => URL.revokeObjectURL(url);
          });
          return;
        }
      }
      // ملاحظة: الكتابة داخل مربعات النص (نص حر، ملاحظة لاصقة، عقدة قالب)
      // تعمل تلقائيًا عبر آلية فابريك الأصلية للنقر المزدوج، لأن كل عنصر
      // نصي أصبح كائنًا مستقلًا على مستوى اللوحة (بدون تجميع).
    };

    const onMouseWheel = (opt: { e: WheelEvent }) => {
      const e = opt.e;
      if (e.ctrlKey || e.metaKey) {
        const z = clampZoom(canvas.getZoom() * 0.999 ** e.deltaY);
        canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), z);
        setZoom(canvas.getZoom());
      } else {
        canvas.relativePan(new fabric.Point(-e.deltaX, -e.deltaY));
      }
      markViewManual();
      constrainView();
      e.preventDefault();
      e.stopPropagation();
    };

    const onSelectionChanged = () => {
      const active = canvas.getActiveObject() as
        | (fabric.Object & { groupedByUser?: boolean })
        | undefined;
      setSelectedLayerId(resolveLayerId(active));
      if (!active) setSelectionKind("none");
      else if (active.type === "activeselection") setSelectionKind("multi");
      else if (active.type === "group" && active.groupedByUser)
        setSelectionKind("userGroup");
      else setSelectionKind("object");
    };
    const onSelectionCleared = () => {
      setSelectedLayerId(null);
      setSelectionKind("none");
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);
    canvas.on("path:created", onPathCreated);
    canvas.on("object:modified", onObjectModified);
    canvas.on("mouse:dblclick", onDoubleClick);
    canvas.on("mouse:wheel", onMouseWheel);
    canvas.on("selection:created", onSelectionChanged);
    canvas.on("selection:updated", onSelectionChanged);
    canvas.on("selection:cleared", onSelectionCleared);

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      canvas.off("path:created", onPathCreated);
      canvas.off("object:modified", onObjectModified);
      canvas.off("mouse:dblclick", onDoubleClick);
      canvas.off("mouse:wheel", onMouseWheel);
      canvas.off("selection:created", onSelectionChanged);
      canvas.off("selection:updated", onSelectionChanged);
      canvas.off("selection:cleared", onSelectionCleared);
      diagram.dispose();
      diagramRef.current = null;
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync free-drawing mode & brush with active tool
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (activeTool !== "eraser") {
      isErasingRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEraserCursor((c) => (c.visible ? { ...c, visible: false } : c));
    }

    const freeDrawTools: ToolType[] = ["pen", "spray", "highlighter"];
    const crosshairTools: ToolType[] = [
      "rectangle",
      "rounded",
      "pill",
      "circle",
      "diamond",
      "triangle",
      "hexagon",
      "parallelogram",
      "star",
      "line",
      "arrow",
      "elbow",
      "curve",
      "voice",
    ];
    canvas.isDrawingMode = freeDrawTools.includes(activeTool);
    canvas.selection = activeTool === "select";
    // بنفك تحديد العنصر عند التحويل لأي أداة تانية، وإلا السحب جواه كان بيحرّكه
    // بدل ما يرسم بالأداة الجديدة.
    if (activeTool !== "select") {
      if (diagramRef.current?.editor.isOpen) diagramRef.current.editor.close(true);
      canvas.discardActiveObject();
    }

    const cursor =
      activeTool === "eraser"
        ? "cell"
        : activeTool === "hand"
          ? "grab"
          : activeTool === "text"
            ? "text"
            : crosshairTools.includes(activeTool)
              ? "crosshair"
              : "default";
    canvas.defaultCursor = cursor;
    canvas.hoverCursor = activeTool === "select" ? "move" : cursor;
    canvas.freeDrawingCursor = "crosshair";

    canvas.forEachObject((obj) => {
      const anyObj = obj as fabric.Object & { locked?: boolean };
      obj.selectable = activeTool === "select" && !anyObj.locked;
      obj.evented = activeTool === "select" ? !anyObj.locked : true;
    });

    if (canvas.isDrawingMode) {
      const width = brushWidthFor(activeTool, settings.size);
      if (activeTool === "spray") {
        const brush = new fabric.SprayBrush(canvas);
        brush.color = colorWithAlpha(settings.color, settings.opacity);
        brush.width = width;
        canvas.freeDrawingBrush = brush;
      } else {
        const brush = new fabric.PencilBrush(canvas);
        // الشفافية جوه لون الخط نفسه (rgba): بتظهر وإحنا بنرسم، وبتتحفظ مع الخط،
        // ومفيش تغميق لما الخط يعدّي على نفسه.
        brush.color = colorWithAlpha(settings.color, settings.opacity);
        brush.width = width;
        if (activeTool === "highlighter") {
          brush.strokeLineCap = "butt";
          brush.strokeLineJoin = "round";
        }
        canvas.freeDrawingBrush = brush;
      }
    }
  }, [activeTool, settings]);

  // دعم اللمس بإصبعين: تكبير/تصغير بالقرص وتحريك اللوحة بإصبعين معًا
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let lastDist = 0;
    let lastMid = { x: 0, y: 0 };
    let wasDrawingBeforePinch = false;

    const getTouchInfo = (touches: TouchList) => {
      const t1 = touches[0];
      const t2 = touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const mid = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      return { dist, mid };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      e.stopPropagation();

      // أوقف وضع الرسم فورًا لحظة ما تلمس إصبع تانية، حتى لا يكمل فابريك
      // رسم خط عشوائي من الإصبع الأولى أثناء حركة القرص بإصبعين.
      const canvas = fabricRef.current;
      if (canvas && canvas.isDrawingMode) {
        wasDrawingBeforePinch = true;
        // ألغِ الرسمة الجارية من الإصبع الأولى بدل ما تتحفظ كخط عشوائي:
        // (1) علم فابريك الداخلي بأن في رسم شغال، (2) معاينة الحبر المؤقتة.
        const internal = canvas as unknown as {
          _isCurrentlyDrawing?: boolean;
          contextTop?: CanvasRenderingContext2D;
          clearContext?: (ctx: CanvasRenderingContext2D) => void;
        };
        internal._isCurrentlyDrawing = false;
        if (internal.contextTop && internal.clearContext) {
          internal.clearContext(internal.contextTop);
        }
        canvas.isDrawingMode = false;
      }

      const { dist, mid } = getTouchInfo(e.touches);
      lastDist = dist;
      lastMid = mid;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      const canvas = fabricRef.current;
      if (!canvas) return;
      const rect = el.getBoundingClientRect();
      const { dist, mid } = getTouchInfo(e.touches);

      if (lastDist > 0) {
        const scaleDelta = dist / lastDist;
        const z = clampZoom(canvas.getZoom() * scaleDelta);
        canvas.zoomToPoint(
          new fabric.Point(mid.x - rect.left, mid.y - rect.top),
          z
        );
        setZoom(canvas.getZoom());
      }

      canvas.relativePan(
        new fabric.Point(mid.x - lastMid.x, mid.y - lastMid.y)
      );
      markViewManual();
      constrainView();

      lastDist = dist;
      lastMid = mid;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastDist = 0;
        if (wasDrawingBeforePinch) {
          wasDrawingBeforePinch = false;
          // نؤجل إرجاع وضع الرسم لما بعد ما يخلّص فابريك معالجة رفع الإصبع،
          // وإلا يعتبر إن في رسمة شغالة ويحفظها كخط عشوائي.
          setTimeout(() => {
            const canvas = fabricRef.current;
            const freeDrawTools: ToolType[] = ["pen", "spray", "highlighter"];
            if (canvas && freeDrawTools.includes(activeToolRef.current)) {
              canvas.isDrawingMode = true;
            }
          }, 0);
        }
      }
    };

    el.addEventListener("touchstart", onTouchStart, {
      passive: false,
      capture: true,
    });
    el.addEventListener("touchmove", onTouchMove, {
      passive: false,
      capture: true,
    });
    el.addEventListener("touchend", onTouchEnd, { capture: true });
    el.addEventListener("touchcancel", onTouchEnd, { capture: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart, { capture: true });
      el.removeEventListener("touchmove", onTouchMove, { capture: true });
      el.removeEventListener("touchend", onTouchEnd, { capture: true });
      el.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    };
  }, [constrainView]);

  /** يسترجع لقطة محفوظة على اللوحة. التعليق (suppress) يتفك دايمًا حتى لو حصل خطأ. */
  const restoreSnapshot = async (snapshotJSON: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    history.setSuppressed(true);
    try {
      canvas.discardActiveObject();
      setSelectedLayerId(null);
      setSelectionKind("none");
      await canvas.loadFromJSON(JSON.parse(snapshotJSON));
      canvas.renderAll();
      refreshLayers();
      refreshVoiceNotes();
      if (modeRef.current === "pdf") {
        const next = [...pagesRef.current];
        next[currentPageIndexRef.current] = {
          ...next[currentPageIndexRef.current],
          json: serializeCanvas(canvas),
        };
        pagesRef.current = next;
        setPages(next);
      }
      persist();
    } finally {
      history.setSuppressed(false);
    }
  };

  const handleUndo = () => {
    const prev = history.undo();
    if (prev) void restoreSnapshot(prev);
  };

  const handleRedo = () => {
    const next = history.redo();
    if (next) void restoreSnapshot(next);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        Boolean(target?.isContentEditable) ||
        Boolean(
          (fabricRef.current?.getActiveObject() as
            | { isEditing?: boolean }
            | undefined)?.isEditing
        );
      if (isTyping) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "0") {
          e.preventDefault();
          keyActionsRef.current.resetZoom();
        } else if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          keyActionsRef.current.zoomBy(1.2);
        } else if (e.key === "-") {
          e.preventDefault();
          keyActionsRef.current.zoomBy(1 / 1.2);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const canvas = fabricRef.current;
        const active = canvas?.getActiveObjects() ?? [];
        const removable = active.filter(
          (o) => !(o as fabric.Object & { locked?: boolean }).locked
        );
        if (canvas && removable.length > 0) {
          e.preventDefault();
          canvas.discardActiveObject();
          removable.forEach((o) => canvas.remove(o));
          canvas.requestRenderAll();
          snapshot();
        }
        return;
      }

      if (modeRef.current === "pdf") {
        const current = currentPageIndexRef.current;
        if (e.key === "PageDown") {
          e.preventDefault();
          void keyActionsRef.current.goToPage(current + 1);
        } else if (e.key === "PageUp") {
          e.preventDefault();
          void keyActionsRef.current.goToPage(current - 1);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findObjectById = (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return (
      canvas
        .getObjects()
        .find((o) => (o as fabric.Object & { id?: string }).id === id) ?? null
    );
  };

  const handleGroupSelection = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const group = groupActiveSelection(canvas);
    if (!group) return;
    const anyGroup = group as fabric.Object & {
      id?: string;
      name?: string;
      kind?: IconName;
      groupedByUser?: boolean;
    };
    anyGroup.id = crypto.randomUUID();
    anyGroup.name = "مجموعة";
    anyGroup.kind = "group";
    anyGroup.groupedByUser = true;
    setSelectionKind("userGroup");
    setSelectedLayerId(anyGroup.id ?? null);
    snapshot();
  };

  const handleUngroupSelection = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    ungroupSelection(canvas);
    setSelectionKind("none");
    setSelectedLayerId(null);
    snapshot();
  };

  const handleSelectLayer = (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = getLayerObjects(canvas, id);
    if (objs.length === 0) return;
    if (objs.length === 1) canvas.setActiveObject(objs[0]);
    else canvas.setActiveObject(new fabric.ActiveSelection(objs, { canvas }));
    canvas.requestRenderAll();
    setSelectedLayerId(id);
  };

  const handleToggleVisible = (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = getLayerObjects(canvas, id);
    const current = layers.find((l) => l.id === id)?.visible ?? true;
    objs.forEach((o) => o.set({ visible: !current }));
    canvas.requestRenderAll();
    snapshot();
  };

  const handleToggleLock = (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = getLayerObjects(canvas, id) as (fabric.Object & {
      locked?: boolean;
    })[];
    const current = layers.find((l) => l.id === id)?.locked ?? false;
    const next = !current;
    objs.forEach((o) => {
      o.locked = next;
      o.selectable = !next;
      o.evented = !next;
    });
    canvas.requestRenderAll();
    snapshot();
  };

  const handleRenameLayer = (id: string, name: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = getLayerObjects(canvas, id) as (fabric.Object & {
      name?: string;
      groupTag?: string;
      groupLabel?: string;
    })[];
    objs.forEach((o) => {
      if (o.groupTag) o.groupLabel = name;
      else o.name = name;
    });
    snapshot();
  };

  const handleMoveUp = (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    getLayerObjects(canvas, id).forEach((o) => canvas.bringObjectForward(o));
    snapshot();
  };

  const handleMoveDown = (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    getLayerObjects(canvas, id).forEach((o) => canvas.sendObjectBackwards(o));
    snapshot();
  };

  const handleReorderLayers = (orderedIdsBottomToTop: string[]) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let index = 0;
    orderedIdsBottomToTop.forEach((id) => {
      getLayerObjects(canvas, id).forEach((obj) => {
        canvas.moveObjectTo(obj, index);
        index += 1;
      });
    });
    canvas.requestRenderAll();
    snapshot();
  };

  const handleDeleteLayer = (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    getLayerObjects(canvas, id).forEach((o) => canvas.remove(o));
    snapshot();
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleImportImage = () => fileInputRef.current?.click();

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    const canvas = fabricRef.current;
    e.target.value = "";
    if (!file || !canvas) return;
    try {
      const url = await readImageAsDataUrl(file);
      const img = await fabric.FabricImage.fromURL(url);
      img.scaleToWidth(300);
      const anyImg = img as fabric.Object & {
        id?: string;
        name?: string;
        kind?: IconName;
      };
      anyImg.id = crypto.randomUUID();
      anyImg.name = "صورة";
      anyImg.kind = "image";
      canvas.add(img);
      canvas.viewportCenterObject(img);
      canvas.setActiveObject(img);
      snapshot();
    } catch (error) {
      console.error("[image] تعذّر استيراد الصورة", error);
      alert("تعذّر قراءة هذه الصورة. جرّب صورة أخرى.");
    }
  };

  const handleExportPNG = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const pageRect = currentPageRect();
    const dataUrl = pageRect
      ? exportSceneRect(canvas, pageRect, {
          format: "png",
          multiplier: pageExportMultiplier(pageRect),
        })
      : canvas.toDataURL({ format: "png", multiplier: 2 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${board.name}.png`;
    link.click();
  };

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const handleImportPdfClick = () => pdfInputRef.current?.click();

  const onPdfSelected: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    const canvas = fabricRef.current;
    const input = e.target;
    if (!file || !canvas) return;

    if (
      modeRef.current === "freeform" &&
      canvas.getObjects().length > 0 &&
      !window.confirm(
        "استيراد PDF سيحوّل هذه اللوحة إلى وضع PDF وستفقد الرسومات الحالية. هل تريد المتابعة؟"
      )
    ) {
      input.value = "";
      return;
    }

    setPdfBusy({ kind: "import", done: 0, total: 0 });
    try {
      const imported = await importPdfPages(file, {
        onProgress: (done, total) => setPdfBusy({ kind: "import", done, total }),
      });
      if (imported.length === 0) {
        alert("لم يتم العثور على أي صفحات قابلة للقراءة في هذا الملف.");
        return;
      }

      // صور الصفحات بتتخزن في IndexedDB (مش localStorage اللي كان بيملى بسرعة)
      try {
        await deleteBoardPageImages(board.id);
        await savePageImages(
          board.id,
          imported.map((page) => page.image)
        );
      } catch (error) {
        console.error("[pdf] تعذّر حفظ صور الصفحات", error);
        throw new PdfImportError(
          "تعذّر حفظ صفحات الـ PDF على جهازك (المساحة ممتلئة أو التخزين غير متاح). احذف لوحات قديمة أو جرّب ملفًا أصغر."
        );
      }

      const newPages: PdfPageState[] = imported.map((page) => ({
        width: page.width,
        height: page.height,
        json: null,
      }));

      canvas.discardActiveObject();
      canvas.clear();
      getPageImages().clear();
      modeRef.current = "pdf";
      pagesRef.current = newPages;
      currentPageIndexRef.current = 0;
      await loadPageBackground(0);
      applyAppearance();
      fitCurrentPage();
      canvas.renderAll();
      newPages[0] = { ...newPages[0], json: serializeCanvas(canvas) };

      setMode("pdf");
      setPages(newPages);
      setCurrentPageIndex(0);
      refreshLayers();
      refreshVoiceNotes();
      history.reset(JSON.stringify(serializeCanvas(canvas)));
      persist();
      void getPageImages().urlFor(1);
    } catch (err) {
      console.error("[pdf] فشل الاستيراد", err);
      const message =
        err instanceof PdfImportError
          ? err.message
          : "حدث خطأ غير متوقع أثناء استيراد ملف PDF. جرّب ملفًا آخر أو أصغر.";
      alert(message);
    } finally {
      setPdfBusy(null);
      input.value = "";
    }
  };

  const handleExportPDF = async () => {
    const canvas = fabricRef.current;
    const pageRect = currentPageRect();
    if (!canvas || !pageRect) return;

    const currentIndex = currentPageIndexRef.current;
    const updatedPages = [...pagesRef.current];
    updatedPages[currentIndex] = {
      ...updatedPages[currentIndex],
      json: serializeCanvas(canvas),
    };

    setPdfBusy({ kind: "export", done: 0, total: updatedPages.length });
    try {
      const blob = await exportPagesAsPdf(updatedPages, async (index) => {
        setPdfBusy({
          kind: "export",
          done: index + 1,
          total: updatedPages.length,
        });
        if (index === currentIndex) {
          return exportSceneRect(canvas, pageRect, {
            format: "jpeg",
            quality: 0.92,
            multiplier: pageExportMultiplier(pageRect),
          });
        }
        return renderPageOffscreen(
          updatedPages[index],
          await getPageImages().urlFor(index)
        );
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${board.name}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error("[pdf] فشل التصدير", error);
      alert("تعذّر تصدير ملف PDF. جرّب مرة تانية أو صدّر الصفحات كصور.");
    } finally {
      setPdfBusy(null);
    }
  };

  const goToPage = async (index: number) => {
    const canvas = fabricRef.current;
    if (
      !canvas ||
      index === currentPageIndexRef.current ||
      index < 0 ||
      index >= pagesRef.current.length ||
      pageSwitchingRef.current
    ) {
      return;
    }
    pageSwitchingRef.current = true;

    try {
      const currentIndex = currentPageIndexRef.current;
      const updatedPages = [...pagesRef.current];
      updatedPages[currentIndex] = {
        ...updatedPages[currentIndex],
        json: serializeCanvas(canvas),
      };
      const target = updatedPages[index];

      canvas.discardActiveObject();
      pagesRef.current = updatedPages;
      currentPageIndexRef.current = index;
      canvas.clear();
      if (target.json) {
        await canvas.loadFromJSON(target.json as Record<string, unknown>);
      }
      await loadPageBackground(index);
      if (!target.json) {
        updatedPages[index] = { ...target, json: serializeCanvas(canvas) };
      }
      applyAppearance();
      fitCurrentPage();
      canvas.renderAll();

      setPages(updatedPages);
      setCurrentPageIndex(index);
      refreshLayers();
      refreshVoiceNotes();
      history.reset(JSON.stringify(serializeCanvas(canvas)));
      persist();

      // نجهّز الصفحة اللي بعدها مقدمًا عشان التقليب يبقى لحظي
      void getPageImages().urlFor(index + 1);
    } catch (error) {
      console.error("[pdf] تعذّر الانتقال للصفحة", error);
    } finally {
      pageSwitchingRef.current = false;
    }
  };

  const createVoiceMarker = (
    point: { x: number; y: number },
    audioNoteId: string,
    durationSeconds: number
  ) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const radius = 16;
    const marker = new fabric.Group(
      [
        new fabric.Circle({
          radius,
          left: 0,
          top: 0,
          fill: "#1f6f63",
          originX: "center",
          originY: "center",
        }),
        new fabric.Line([-5, -4, -5, 4], {
          stroke: "#ffffff",
          strokeWidth: 2.2,
          strokeLineCap: "round",
          originX: "center",
          originY: "center",
        }),
        new fabric.Line([0, -6, 0, 6], {
          stroke: "#ffffff",
          strokeWidth: 2.2,
          strokeLineCap: "round",
          originX: "center",
          originY: "center",
        }),
        new fabric.Line([5, -4, 5, 4], {
          stroke: "#ffffff",
          strokeWidth: 2.2,
          strokeLineCap: "round",
          originX: "center",
          originY: "center",
        }),
      ],
      { left: point.x - radius, top: point.y - radius }
    );
    const anyMarker = marker as fabric.Object & {
      id?: string;
      name?: string;
      kind?: IconName;
      audioNoteId?: string;
      audioDurationSeconds?: number;
      audioRecordedAt?: string;
    };
    anyMarker.id = crypto.randomUUID();
    anyMarker.name = "ملاحظة صوتية";
    anyMarker.kind = "voice";
    anyMarker.audioNoteId = audioNoteId;
    anyMarker.audioDurationSeconds = durationSeconds;
    anyMarker.audioRecordedAt = new Date().toISOString();
    canvas.add(marker);
  };

  const handleRecorderSave = async (blob: Blob, durationSeconds: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const newAudioId = crypto.randomUUID();
    await saveAudioBlob(newAudioId, blob);

    if (rerecordTargetRef.current) {
      const obj = findObjectById(rerecordTargetRef.current) as
        | (fabric.Object & {
            audioNoteId?: string;
            audioDurationSeconds?: number;
            audioRecordedAt?: string;
          })
        | null;
      if (obj) {
        const oldAudioId = obj.audioNoteId;
        obj.audioNoteId = newAudioId;
        obj.audioDurationSeconds = durationSeconds;
        obj.audioRecordedAt = new Date().toISOString();
        if (oldAudioId) await deleteAudioBlob(oldAudioId);
      }
      rerecordTargetRef.current = null;
    } else if (pendingPointRef.current) {
      createVoiceMarker(pendingPointRef.current, newAudioId, durationSeconds);
      pendingPointRef.current = null;
      setActiveTool("select");
    }

    canvas.renderAll();
    setRecorderOpen(false);
    snapshot();
  };

  const handleRecorderCancel = () => {
    pendingPointRef.current = null;
    rerecordTargetRef.current = null;
    setRecorderOpen(false);
    if (activeToolRef.current === "voice") setActiveTool("select");
  };

  const handlePlayVoiceNote = async (audioNoteId: string) => {
    const blob = await getAudioBlob(audioNoteId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  };

  const handleRerecordVoiceNote = (objectId: string) => {
    rerecordTargetRef.current = objectId;
    pendingPointRef.current = null;
    setRecorderOpen(true);
  };

  const handleDeleteVoiceNote = async (objectId: string) => {
    const canvas = fabricRef.current;
    const obj = findObjectById(objectId) as
      | (fabric.Object & { audioNoteId?: string })
      | null;
    if (!canvas || !obj) return;
    if (obj.audioNoteId) await deleteAudioBlob(obj.audioNoteId);
    canvas.remove(obj);
    canvas.renderAll();
    snapshot();
  };

  const handleUseTemplate = (id: TemplateId) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // مركز الجزء الظاهر حاليًا (مش مركز الكانفا)، عشان القالب يظهر قدام المستخدم
    // حتى لو كان مكبّر أو محرّك اللوحة.
    const center = canvas.getVpCenter();
    const objects = buildTemplate(id, center.x, center.y);
    const info = TEMPLATES.find((t) => t.id === id);

    // كل عناصر القالب مستقلة على مستوى اللوحة (لا تجميع) حتى تعمل الكتابة
    // المباشرة في عقد النص، وتظهر كطبقة واحدة مجمّعة عبر groupTag مشترك.
    const templateTag = crypto.randomUUID();
    objects.forEach((obj) => {
      const anyObj = obj as fabric.Object & {
        groupTag?: string;
        groupLabel?: string;
        groupIcon?: IconName;
      };
      anyObj.groupTag = templateTag;
      anyObj.groupLabel = info?.title ?? "قالب";
      anyObj.groupIcon = info?.icon ?? "templates";
      canvas.add(obj);
    });

    canvas.renderAll();
    setTemplatesOpen(false);
    snapshot();
  };

  const stopVideoTimer = () => {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    videoTimerRef.current = null;
  };

  const cleanupVideoStreams = () => {
    videoMicStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoMicStreamRef.current = null;
    videoCompositeRef.current?.stop();
    videoCompositeRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopVideoTimer();
      cleanupVideoStreams();
      if (videoMaxTimeoutRef.current) clearTimeout(videoMaxTimeoutRef.current);
    };
  }, []);

  const finalizeVideoRecording = () => {
    const blob = new Blob(videoChunksRef.current, {
      type: videoMimeTypeRef.current || "video/webm",
    });
    videoBlobRef.current = blob;
    setVideoPreviewUrl(URL.createObjectURL(blob));
    setVideoStatus("recorded");
    stopVideoTimer();
    cleanupVideoStreams();
    if (videoMaxTimeoutRef.current) clearTimeout(videoMaxTimeoutRef.current);
    videoMaxTimeoutRef.current = null;
  };

  const stopRecorderSafely = () => {
    const recorder = videoRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  /** لون خلفية الفيديو الاحتياطي = خلفية اللوحة الحالية. */
  const recordingBackground = () =>
    modeRef.current === "pdf" ? "#ffffff" : canvasSettingsRef.current.background;

  const createRecorder = (stream: MediaStream) => {
    const mimeType = pickVideoMimeType();
    videoMimeTypeRef.current = mimeType;
    videoChunksRef.current = [];
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 3_000_000,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };
    videoRecorderRef.current = recorder;
    return recorder;
  };

  const startVideoClock = () => {
    setVideoElapsed(0);
    videoTimerRef.current = setInterval(() => {
      setVideoElapsed((e) => e + 1);
    }, 1000);
    videoMaxTimeoutRef.current = setTimeout(() => {
      videoCancelReplayRef.current = true;
      stopRecorderSafely();
    }, MAX_VIDEO_SECONDS * 1000);
  };

  const handleStartLiveVideo = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      canvas.discardActiveObject();
      canvas.renderAll();

      // لو المايك مش متاح بنكمّل تسجيل بدون صوت بدل ما نفشل التسجيل كله
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        micStream = null;
      }
      videoMicStreamRef.current = micStream;
      setVideoNoAudio(!micStream);

      const composite = createCompositeStream(canvas, {
        background: recordingBackground(),
      });
      videoCompositeRef.current = composite;
      if (process.env.NEXT_PUBLIC_E2E === "1") {
        (window as unknown as { __composite?: CompositeStream }).__composite = composite;
      }

      const combined = new MediaStream([
        ...composite.stream.getVideoTracks(),
        ...(micStream ? micStream.getAudioTracks() : []),
      ]);
      const recorder = createRecorder(combined);
      recorder.onstop = finalizeVideoRecording;
      recorder.start(1000);
      setVideoStatus("recording");
      startVideoClock();
    } catch {
      cleanupVideoStreams();
      alert("تعذّر بدء التسجيل على هذا الجهاز.");
    }
  };

  const handleStartReplay = async (speed: 1 | 2 | 4) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // في وضع PDF بنعيد خطوات الصفحة الحالية بس (لكل صفحة مقاس مختلف)
    const steps = sessionStepsRef.current.filter(
      (s) => modeRef.current !== "pdf" || s.pageIndex === currentPageIndexRef.current
    );
    if (steps.length < 2) {
      alert("ارسم خطوتين على الأقل (في الصفحة الحالية) عشان تقدر تعيد التشغيل.");
      return;
    }

    const savedJSON = serializeCanvas(canvas);
    const originalSize = { width: canvas.getWidth(), height: canvas.getHeight() };

    // نبدأ من لوحة فاضية عشان الإعادة تترسم من الأول
    canvas.discardActiveObject();
    canvas.clear();
    applyAppearance();
    canvas.renderAll();

    let composite: CompositeStream;
    try {
      composite = createCompositeStream(canvas, { background: recordingBackground() });
    } catch {
      alert("تعذّر بدء التسجيل على هذا الجهاز.");
      return;
    }
    videoCompositeRef.current = composite;
    if (process.env.NEXT_PUBLIC_E2E === "1") {
      (window as unknown as { __composite?: CompositeStream }).__composite = composite;
    }
    setVideoNoAudio(false);

    const recorder = createRecorder(composite.stream);
    videoCancelReplayRef.current = false;

    recorder.onstop = () => {
      void (async () => {
        try {
          canvas.setDimensions(originalSize);
          await canvas.loadFromJSON(savedJSON as Record<string, unknown>);
          canvas.renderAll();
          refreshLayers();
          refreshVoiceNotes();
        } finally {
          finalizeVideoRecording();
        }
      })();
    };

    recorder.start(1000);
    setVideoStatus("replaying");
    startVideoClock();

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await playSessionReplay({
        canvas,
        steps,
        speed,
        isCancelled: () => videoCancelReplayRef.current,
        afterLoad: refreshLayers,
        onLoadStart: () => composite.setPaused(true),
        onLoadEnd: () => composite.setPaused(false),
      });
      // نثبّت آخر لقطة ثانية قبل ما ننهي الفيديو
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      // أي خطأ غير متوقع: ننهي التسجيل بأمان بدل ما يفضل معلّق
    } finally {
      stopRecorderSafely();
    }
  };

  const handleStopVideo = () => {
    if (videoStatus === "replaying") videoCancelReplayRef.current = true;
    stopRecorderSafely();
  };

  const handleDownloadVideo = () => {
    if (!videoBlobRef.current) return;
    const ext = videoFileExtension(videoMimeTypeRef.current || "video/webm");
    downloadBlob(videoBlobRef.current, `${board.name}.${ext}`);
  };

  const handleDiscardVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    videoBlobRef.current = null;
    setVideoStatus("idle");
    setVideoElapsed(0);
  };

  const handleCloseVideoModal = () => {
    if (videoStatus === "recording" || videoStatus === "replaying") return;
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    videoBlobRef.current = null;
    setVideoStatus("idle");
    setVideoElapsed(0);
    setVideoModalOpen(false);
  };

  const handleSettingsChange = (next: CanvasSettings) => {
    const prev = canvasSettingsRef.current;
    canvasSettingsRef.current = next;
    setCanvasSettings(next);
    applyAppearance();

    // على الخلفية الداكنة الحبر الغامق مبيبانش: نبدّل لون القلم تلقائيًا
    const darkNow = isDarkColor(next.background);
    if (darkNow !== isDarkColor(prev.background)) {
      const adaptInk = (t: ToolSettings): ToolSettings => {
        if (darkNow && isDarkColor(t.color)) return { ...t, color: "#ffffff" };
        if (!darkNow && t.color.toLowerCase() === "#ffffff")
          return { ...t, color: INK_DEFAULTS.color };
        return t;
      };
      settingsMemoryRef.current.ink = adaptInk(settingsMemoryRef.current.ink);
      if (settingsGroupOf(activeToolRef.current) === "ink") {
        setSettings(adaptInk);
      }
    }
    persist();
  };

  const handleZoomBy = (factor: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // نكبّر حوالين مركز المساحة المتاحة (بين الأشرطة) مش مركز الشاشة كلها
    const insets = currentPageRect()
      ? PDF_VIEW_INSETS
      : { top: 0, bottom: 0, side: 0 };
    const center = new fabric.Point(
      canvas.getWidth() / 2,
      insets.top + (canvas.getHeight() - insets.top - insets.bottom) / 2
    );
    canvas.zoomToPoint(center, clampZoom(canvas.getZoom() * factor));
    setZoom(canvas.getZoom());
    markViewManual();
    constrainView();
  };

  /** في وضع PDF: ملاءمة الصفحة للشاشة. في اللوحة الحرة: رجوع لـ 100٪. */
  const handleResetZoom = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (currentPageRect()) {
      fitCurrentPage();
      return;
    }
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
  };

  const handleToolChange = (next: ToolType) => {
    const previousGroup = settingsGroupOf(activeToolRef.current);
    const nextGroup = settingsGroupOf(next);
    if (previousGroup !== nextGroup) {
      settingsMemoryRef.current[previousGroup] = settingsRef.current;
      setSettings(settingsMemoryRef.current[nextGroup]);
    }
    setActiveTool(next);
  };

  // اختصارات لوحة المفاتيح لازم تشوف آخر نسخة من الدوال دي (الـ effect بيتسجل مرة واحدة)
  useEffect(() => {
    keyActionsRef.current = {
      goToPage,
      zoomBy: handleZoomBy,
      resetZoom: handleResetZoom,
    };
  });

  const canvasIsEmpty = mode === "freeform" && layers.length === 0;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-paper">
      <div ref={containerRef} className="h-full w-full overflow-hidden">
        {/* مهم: نفس شجرة العناصر في الوضعين. فابريك بينقل عنصر canvas لحاوية
            خاصة به، فلو غيّرنا مكانه في React عند التحويل لوضع PDF يحصل خطأ
            removeChild وتقفل الصفحة. */}
        <div>
          <canvas ref={canvasElRef} />
        </div>
      </div>

      {canvasIsEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface/80 text-ink-faint shadow-panel">
            <Icon name="pen" size={24} />
          </span>
          <p className="text-sm text-ink-faint">
            اللوحة فاضية — اختر أداة وابدأ الرسم
          </p>
        </div>
      )}

      {pdfBusy && (
        <div
          role="status"
          className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-paper/80"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-3 shadow-panel-lg">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-sm text-ink-soft">
              {pdfBusy.kind === "import"
                ? "جارِ معالجة ملف PDF..."
                : "جارِ تجهيز ملف PDF..."}
              {pdfBusy.total > 0 && (
                <span className="ms-2 tabular-nums text-ink-faint">
                  {pdfBusy.done} / {pdfBusy.total}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {saveFailed && (
        <div className="pointer-events-none absolute inset-x-0 top-[72px] z-30 flex justify-center px-3">
          <div
            role="alert"
            className="pointer-events-auto max-w-md rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-center text-xs leading-5 text-danger shadow-panel"
          >
            مساحة التخزين على الجهاز ممتلئة — آخر تعديلاتك غير محفوظة. صدّر
            اللوحة أو احذف لوحات قديمة من الصفحة الرئيسية.
          </div>
        </div>
      )}

      {eraserCursor.visible && (
        <div
          className="pointer-events-none absolute z-30 rounded-full border-2 border-ink/50 bg-ink/10"
          style={{
            width: Math.max(settings.size * 2 * zoom, 14),
            height: Math.max(settings.size * 2 * zoom, 14),
            left: eraserCursor.x,
            top: eraserCursor.y,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      <Toolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        noteStyle={noteStyle}
        onNoteStyleChange={setNoteStyle}
        settings={settings}
        onSettingsChange={setSettings}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onImportImage={handleImportImage}
        onImportPDF={handleImportPdfClick}
        onExportPNG={handleExportPNG}
        onExportPDF={handleExportPDF}
        isPdfMode={mode === "pdf"}
        onOpenVoiceNotes={() => setVoiceNotesPanelOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenVideoExport={() => setVideoModalOpen(true)}
        onToggleLayers={() => {
          setLayersOpen((v) => !v);
          setSettingsOpen(false);
        }}
        layersOpen={layersOpen}
        onToggleSettings={() => {
          setSettingsOpen((v) => !v);
          setLayersOpen(false);
        }}
        settingsOpen={settingsOpen}
        canGroup={selectionKind === "multi"}
        canUngroup={selectionKind === "userGroup"}
        onGroup={handleGroupSelection}
        onUngroup={handleUngroupSelection}
      />

      <CanvasSettingsPanel
        open={settingsOpen}
        settings={canvasSettings}
        disabled={mode === "pdf"}
        onChange={handleSettingsChange}
        onClose={() => setSettingsOpen(false)}
      />

      <LayersPanel
        open={layersOpen}
        layers={layers}
        selectedId={selectedLayerId}
        onSelect={handleSelectLayer}
        onToggleVisible={handleToggleVisible}
        onToggleLock={handleToggleLock}
        onRename={handleRenameLayer}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onDelete={handleDeleteLayer}
        onReorder={handleReorderLayers}
      />

      {diagramController && inspector && (
        <InspectorBar diagram={diagramController} model={inspector} />
      )}

      <ZoomControl
        zoom={zoom}
        isPdfMode={mode === "pdf"}
        onZoomIn={() => handleZoomBy(1.15)}
        onZoomOut={() => handleZoomBy(1 / 1.15)}
        onReset={handleResetZoom}
      />

      {mode === "pdf" && (
        <PageNavigator
          pageCount={pages.length}
          currentIndex={currentPageIndex}
          onSelect={goToPage}
          loadThumbnail={(index) => getPageImages().urlFor(index)}
        />
      )}
      {recorderOpen && (
        <VoiceRecorderModal
          onCancel={handleRecorderCancel}
          onSave={handleRecorderSave}
        />
      )}
      <VoiceNotesPanel
        open={voiceNotesPanelOpen}
        notes={voiceNotes}
        onClose={() => setVoiceNotesPanelOpen(false)}
        onPlay={handlePlayVoiceNote}
        onRerecord={handleRerecordVoiceNote}
        onDelete={handleDeleteVoiceNote}
      />
      <TemplatesPanel
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={handleUseTemplate}
      />
      {videoModalOpen && (
        <VideoExportModal
          status={videoStatus}
          elapsedSeconds={videoElapsed}
          previewUrl={videoPreviewUrl}
          canReplay={sessionStepsCount >= 2}
          noAudio={videoNoAudio}
          onStartLive={handleStartLiveVideo}
          onStop={handleStopVideo}
          onStartReplay={handleStartReplay}
          onDownload={handleDownloadVideo}
          onDiscard={handleDiscardVideo}
          onClose={handleCloseVideoModal}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelected}
        className="hidden"
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={onPdfSelected}
        className="hidden"
      />
    </div>
  );
}
