"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as fabric from "fabric";
import { Icon, IconName } from "@/features/shared/icons/Icon";
import { LayerItem, ToolSettings, ToolType, VoiceNoteMeta } from "../types";
import { useCanvasHistory } from "../hooks/useCanvasHistory";
import { Toolbar } from "./Toolbar";
import { LayersPanel } from "./LayersPanel";
import { PageNavigator } from "./PageNavigator";
import { ZoomControl } from "./ZoomControl";
import { VoiceRecorderModal } from "./VoiceRecorderModal";
import { VoiceNotesPanel } from "./VoiceNotesPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import { VideoExportModal } from "./VideoExportModal";
import { saveBoard } from "@/features/boards/lib/boardStorage";
import { BoardData, BoardMode, PdfPageState } from "@/features/boards/types";
import { exportPagesAsPdf, importPdfPages } from "../lib/pdf";
import { buildTemplate, TEMPLATES, TemplateId } from "../lib/templates";
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

const EXTRA_PROPS = [
  "id",
  "name",
  "locked",
  "kind",
  "audioNoteId",
  "audioDurationSeconds",
  "audioRecordedAt",
];

interface WhiteboardCanvasProps {
  board: BoardData;
}

function shapeName(tool: ToolType) {
  const map: Record<string, string> = {
    rectangle: "مستطيل",
    circle: "دائرة",
    triangle: "مثلث",
    line: "خط",
    arrow: "سهم",
    star: "نجمة",
    text: "نص",
    sticky: "ملاحظة",
    pen: "رسمة",
    spray: "رشّ",
    highlighter: "تظليل",
  };
  return map[tool] ?? "عنصر";
}

// نفس أسماء الأدوات تُستخدم كأيقونة الطبقة في لوحة الطبقات
const KIND_MAP: Record<ToolType, IconName> = {
  select: "select",
  pen: "pen",
  spray: "spray",
  highlighter: "highlighter",
  eraser: "eraser",
  text: "text",
  sticky: "sticky",
  voice: "voice",
  rectangle: "rectangle",
  circle: "circle",
  triangle: "triangle",
  line: "line",
  arrow: "arrow",
  star: "star",
};

/** يبحث بعمق داخل الكائنات (حتى المتداخلة في مجموعات) عن مربع نص عند نقطة معيّنة. */
function findTextboxAtPoint(
  obj: fabric.Object,
  point: fabric.Point
): fabric.Textbox | null {
  if (obj.type === "textbox" && obj.containsPoint(point)) {
    return obj as fabric.Textbox;
  }
  if (obj.type === "group") {
    const children = (obj as fabric.Group).getObjects();
    for (let i = children.length - 1; i >= 0; i--) {
      const found = findTextboxAtPoint(children[i], point);
      if (found) return found;
    }
  }
  return null;
}

/** يربط كل مربعات النص المتداخلة داخل عنصر (مجموعة) بحدث نهاية التحرير. */
function attachNestedTextEditing(obj: fabric.Object, onExit: () => void) {
  if (obj.type !== "group") return;
  (obj as fabric.Group).getObjects().forEach((child) => {
    if (child.type === "textbox") {
      (child as fabric.Textbox).on("editing:exited", onExit);
    } else if (child.type === "group") {
      attachNestedTextEditing(child, onExit);
    }
  });
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
function resolveLayerId(obj: fabric.Object | null | undefined): string | null {
  let current = obj as (fabric.Object & { id?: string; group?: fabric.Object }) | null | undefined;
  while (current) {
    if (current.id) return current.id;
    current = current.group as typeof current;
  }
  return null;
}

async function renderPageOffscreen(page: PdfPageState): Promise<string> {
  const el = document.createElement("canvas");
  const staticCanvas = new fabric.StaticCanvas(el, {
    width: page.width,
    height: page.height,
  });
  if (page.json) {
    await new Promise<void>((resolve) => {
      staticCanvas.loadFromJSON(page.json as Record<string, unknown>, () => resolve());
    });
  }
  staticCanvas.renderAll();
  const dataUrl = staticCanvas.toDataURL({ format: "png", multiplier: 2 });
  staticCanvas.dispose();
  return dataUrl;
}

export function WhiteboardCanvas({ board }: WhiteboardCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const history = useCanvasHistory();

  const [activeTool, setActiveTool] = useState<ToolType>("pen");
  const [settings, setSettings] = useState<ToolSettings>({
    color: "#0f172a",
    size: 4,
    opacity: 1,
  });
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectionKind, setSelectionKind] = useState<
    "none" | "object" | "multi" | "userGroup"
  >("none");
  const [voiceNotes, setVoiceNotes] = useState<VoiceNoteMeta[]>([]);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [voiceNotesPanelOpen, setVoiceNotesPanelOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const [zoom, setZoom] = useState(1);

  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoStatus, setVideoStatus] = useState<
    "idle" | "recording" | "replaying" | "recorded"
  >("idle");
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const sessionStepsRef = useRef<{ json: unknown; t: number }[]>([]);
  const [sessionStepsCount, setSessionStepsCount] = useState(0);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoBlobRef = useRef<Blob | null>(null);
  const videoMimeTypeRef = useRef<string>("");
  const videoMicStreamRef = useRef<MediaStream | null>(null);
  const videoCanvasStreamRef = useRef<MediaStream | null>(null);
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

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  const refreshLayers = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const items: LayerItem[] = canvas.getObjects().map((obj) => {
        const anyObj = obj as fabric.Object & {
          id?: string;
          name?: string;
          locked?: boolean;
          kind?: IconName;
        };
        return {
          id: anyObj.id ?? "",
          name: anyObj.name ?? "عنصر",
          type: obj.type ?? "object",
          icon: anyObj.kind ?? "select",
          visible: obj.visible !== false,
          locked: Boolean(anyObj.locked),
        };
      });
      setLayers(items);
    },
    []
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
      const thumbnail = canvas.toDataURL({ format: "png", multiplier: 0.25 });
      if (modeRef.current === "pdf") {
        saveBoard(
          board.id,
          {
            mode: "pdf",
            pdfPages: pagesRef.current,
            currentPageIndex: currentPageIndexRef.current,
          },
          thumbnail
        );
      } else {
        saveBoard(
          board.id,
          { mode: "freeform", canvasJSON: canvas.toObject(EXTRA_PROPS) },
          thumbnail
        );
      }
    },
    [board.id]
  );

  const snapshot = useMemo(
    () => () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const json = canvas.toObject(EXTRA_PROPS);
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
      sessionStepsRef.current.push({ json, t: Date.now() });
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
      backgroundColor: board.mode === "pdf" ? "#ffffff" : "",
      selection: true,
    });
    fabricRef.current = canvas;

    // هوية بصرية موحدة لعناصر التحديد بدل الأزرق الافتراضي
    fabric.FabricObject.ownDefaults = {
      ...fabric.FabricObject.ownDefaults,
      borderColor: "#1f6f63",
      cornerColor: "#1f6f63",
      cornerStrokeColor: "#ffffff",
      cornerStyle: "circle",
      cornerSize: 9,
      transparentCorners: false,
      borderScaleFactor: 1.5,
      padding: 4,
    };
    canvas.selectionColor = "rgba(31, 111, 99, 0.08)";
    canvas.selectionBorderColor = "#1f6f63";
    canvas.selectionLineWidth = 1.5;

    const resize = () => {
      if (modeRef.current === "pdf") return;
      const el = containerRef.current;
      if (!el) return;
      canvas.setDimensions({ width: el.clientWidth, height: el.clientHeight });
      canvas.renderAll();
    };
    resize();
    window.addEventListener("resize", resize);

    if (board.mode === "pdf" && board.pdfPages.length > 0) {
      const page = board.pdfPages[board.currentPageIndex] ?? board.pdfPages[0];
      canvas.setDimensions({ width: page.width, height: page.height });
      if (page.json) {
        canvas.loadFromJSON(page.json as Record<string, unknown>, () => {
          canvas.renderAll();
          refreshLayers();
          refreshVoiceNotes();
          history.push(JSON.stringify(canvas.toObject(EXTRA_PROPS)));
        });
      }
    } else if (board.canvasJSON) {
      canvas.loadFromJSON(board.canvasJSON, () => {
        canvas.renderAll();
        refreshLayers();
        refreshVoiceNotes();
        history.push(JSON.stringify(canvas.toObject(EXTRA_PROPS)));
      });
    } else {
      history.push(JSON.stringify(canvas.toObject(EXTRA_PROPS)));
    }

    let isDrawingShape = false;
    let shapeOrigin = { x: 0, y: 0 };
    let activeShape: fabric.Object | null = null;

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

    const onMouseDown = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      const tool = activeToolRef.current;
      const s = settingsRef.current;
      const pointer = canvas.getScenePoint(opt.e);

      if (tool === "eraser") {
        const objects = canvas.getObjects();
        for (let i = objects.length - 1; i >= 0; i--) {
          if (objects[i].containsPoint(pointer)) {
            canvas.remove(objects[i]);
            snapshot();
            break;
          }
        }
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

      if (tool === "sticky") {
        const group = new fabric.Group(
          [
            new fabric.Rect({
              width: 180,
              height: 160,
              fill: "#faecd9",
              rx: 12,
              ry: 12,
              shadow: new fabric.Shadow({
                color: "rgba(33, 31, 26, 0.14)",
                blur: 8,
                offsetY: 2,
              }),
            }),
            new fabric.Textbox("ملاحظة...", {
              left: 12,
              top: 12,
              width: 156,
              fontSize: 16,
              fill: "#211f1a",
            }),
          ],
          { left: pointer.x, top: pointer.y }
        );
        assignMeta(group, "sticky");
        attachNestedTextEditing(group, () => {
          canvas.setActiveObject(group);
          canvas.requestRenderAll();
          snapshot();
        });
        canvas.add(group);
        snapshot();
        setActiveTool("select");
        return;
      }

      if (tool === "voice") {
        pendingPointRef.current = { x: pointer.x, y: pointer.y };
        rerecordTargetRef.current = null;
        setRecorderOpen(true);
        return;
      }

      const shapeTools: ToolType[] = [
        "rectangle",
        "circle",
        "triangle",
        "line",
        "arrow",
        "star",
      ];
      if (shapeTools.includes(tool)) {
        isDrawingShape = true;
        shapeOrigin = { x: pointer.x, y: pointer.y };
        const common = {
          left: pointer.x,
          top: pointer.y,
          fill:
            tool === "line" || tool === "arrow" ? undefined : "transparent",
          stroke: s.color,
          strokeWidth: s.size,
          opacity: s.opacity,
        };

        if (tool === "rectangle") {
          activeShape = new fabric.Rect({ ...common, width: 1, height: 1 });
        } else if (tool === "circle") {
          activeShape = new fabric.Ellipse({ ...common, rx: 1, ry: 1 });
        } else if (tool === "triangle") {
          activeShape = new fabric.Triangle({ ...common, width: 1, height: 1 });
        } else if (tool === "line" || tool === "arrow") {
          activeShape = new fabric.Line(
            [pointer.x, pointer.y, pointer.x, pointer.y],
            { stroke: s.color, strokeWidth: s.size, opacity: s.opacity }
          );
        } else if (tool === "star") {
          activeShape = createStar(pointer.x, pointer.y, 1, s.color, s.size, s.opacity);
        }

        if (activeShape) {
          assignMeta(activeShape, tool);
          canvas.add(activeShape);
        }
      }
    };

    const onMouseMove = (opt: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
      if (!isDrawingShape || !activeShape) return;
      const pointer = canvas.getScenePoint(opt.e);
      const width = pointer.x - shapeOrigin.x;
      const height = pointer.y - shapeOrigin.y;

      if (activeShape.type === "rect" || activeShape.type === "triangle") {
        activeShape.set({
          left: width < 0 ? pointer.x : shapeOrigin.x,
          top: height < 0 ? pointer.y : shapeOrigin.y,
          width: Math.abs(width),
          height: Math.abs(height),
        });
      } else if (activeShape.type === "ellipse") {
        (activeShape as fabric.Ellipse).set({
          left: width < 0 ? pointer.x : shapeOrigin.x,
          top: height < 0 ? pointer.y : shapeOrigin.y,
          rx: Math.abs(width) / 2,
          ry: Math.abs(height) / 2,
        });
      } else if (activeShape.type === "line") {
        (activeShape as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
      } else if ((activeShape as fabric.Object & { isStar?: boolean }).isStar) {
        const radius = Math.hypot(width, height);
        const scaled = createStar(
          shapeOrigin.x,
          shapeOrigin.y,
          Math.max(radius, 1),
          settingsRef.current.color,
          settingsRef.current.size,
          settingsRef.current.opacity
        );
        canvas.remove(activeShape);
        assignMeta(scaled, "star");
        canvas.add(scaled);
        activeShape = scaled;
      }
      canvas.requestRenderAll();
    };

    const onMouseUp = () => {
      if (isDrawingShape) {
        isDrawingShape = false;
        activeShape = null;
        snapshot();
        setActiveTool("select");
      }
    };

    const onPathCreated = (e: { path: fabric.Path }) => {
      const tool = activeToolRef.current;
      assignMeta(e.path, tool);
      if (tool === "highlighter") {
        e.path.set({ globalCompositeOperation: "multiply" });
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

      // الكتابة داخل عنصر نصي متداخل (ملاحظة لاصقة أو عقدة قالب)
      for (let i = objects.length - 1; i >= 0; i--) {
        const textObj = findTextboxAtPoint(objects[i], pointer);
        if (textObj) {
          canvas.setActiveObject(textObj);
          textObj.enterEditing();
          textObj.selectAll();
          canvas.requestRenderAll();
          return;
        }
      }
    };

    const onMouseWheel = (opt: { e: WheelEvent }) => {
      const e = opt.e;
      if (e.ctrlKey || e.metaKey) {
        let z = canvas.getZoom() * 0.999 ** e.deltaY;
        z = Math.min(Math.max(z, 0.2), 4);
        canvas.zoomToPoint(
          new fabric.Point(e.offsetX, e.offsetY),
          z
        );
        setZoom(z);
      } else {
        canvas.relativePan(new fabric.Point(-e.deltaX, -e.deltaY));
      }
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
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync free-drawing mode & brush with active tool
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const freeDrawTools: ToolType[] = ["pen", "spray", "highlighter"];
    const crosshairTools: ToolType[] = [
      "rectangle",
      "circle",
      "triangle",
      "line",
      "arrow",
      "star",
      "voice",
    ];
    canvas.isDrawingMode = freeDrawTools.includes(activeTool);
    canvas.selection = activeTool === "select";

    const cursor =
      activeTool === "eraser"
        ? "cell"
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
      if (activeTool === "spray") {
        const brush = new fabric.SprayBrush(canvas);
        brush.color = settings.color;
        brush.width = Math.max(10, settings.size * 2);
        canvas.freeDrawingBrush = brush;
      } else {
        const brush = new fabric.PencilBrush(canvas);
        brush.color = settings.color;
        brush.width =
          activeTool === "highlighter" ? settings.size * 3 : settings.size;
        canvas.freeDrawingBrush = brush;
      }
    }
  }, [activeTool, settings]);

  const handleUndo = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const current = JSON.stringify(canvas.toObject(EXTRA_PROPS));
    const prev = history.undo(current);
    if (!prev) return;
    history.setSuppressed(true);
    canvas.loadFromJSON(JSON.parse(prev), () => {
      canvas.renderAll();
      refreshLayers();
      refreshVoiceNotes();
      if (modeRef.current === "pdf") {
        const next = [...pagesRef.current];
        next[currentPageIndexRef.current] = {
          ...next[currentPageIndexRef.current],
          json: canvas.toObject(EXTRA_PROPS),
        };
        pagesRef.current = next;
        setPages(next);
      }
      persist();
      history.setSuppressed(false);
    });
  };

  const handleRedo = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const current = JSON.stringify(canvas.toObject(EXTRA_PROPS));
    const next = history.redo(current);
    if (!next) return;
    history.setSuppressed(true);
    canvas.loadFromJSON(JSON.parse(next), () => {
      canvas.renderAll();
      refreshLayers();
      refreshVoiceNotes();
      if (modeRef.current === "pdf") {
        const nextPages = [...pagesRef.current];
        nextPages[currentPageIndexRef.current] = {
          ...nextPages[currentPageIndexRef.current],
          json: canvas.toObject(EXTRA_PROPS),
        };
        pagesRef.current = nextPages;
        setPages(nextPages);
      }
      persist();
      history.setSuppressed(false);
    });
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
    attachNestedTextEditing(group, () => {
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      snapshot();
    });
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
    const obj = findObjectById(id);
    if (!canvas || !obj) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    setSelectedLayerId(id);
  };

  const handleToggleVisible = (id: string) => {
    const obj = findObjectById(id);
    if (!obj) return;
    obj.set({ visible: !obj.visible });
    fabricRef.current?.requestRenderAll();
    snapshot();
  };

  const handleToggleLock = (id: string) => {
    const obj = findObjectById(id) as
      | (fabric.Object & { locked?: boolean })
      | null;
    if (!obj) return;
    obj.locked = !obj.locked;
    obj.selectable = !obj.locked;
    obj.evented = !obj.locked;
    fabricRef.current?.requestRenderAll();
    snapshot();
  };

  const handleRenameLayer = (id: string, name: string) => {
    const obj = findObjectById(id) as fabric.Object & { name?: string };
    if (!obj) return;
    obj.name = name;
    snapshot();
  };

  const handleMoveUp = (id: string) => {
    const canvas = fabricRef.current;
    const obj = findObjectById(id);
    if (!canvas || !obj) return;
    canvas.bringObjectForward(obj);
    snapshot();
  };

  const handleMoveDown = (id: string) => {
    const canvas = fabricRef.current;
    const obj = findObjectById(id);
    if (!canvas || !obj) return;
    canvas.sendObjectBackwards(obj);
    snapshot();
  };

  const handleReorderLayers = (orderedIdsBottomToTop: string[]) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    orderedIdsBottomToTop.forEach((id, index) => {
      const obj = findObjectById(id);
      if (obj) canvas.moveObjectTo(obj, index);
    });
    canvas.requestRenderAll();
    snapshot();
  };

  const handleDeleteLayer = (id: string) => {
    const canvas = fabricRef.current;
    const obj = findObjectById(id);
    if (!canvas || !obj) return;
    canvas.remove(obj);
    snapshot();
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleImportImage = () => fileInputRef.current?.click();

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    const canvas = fabricRef.current;
    if (!file || !canvas) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      fabric.FabricImage.fromURL(url).then((img) => {
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
        canvas.setActiveObject(img);
        snapshot();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleExportPNG = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
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
    if (!file || !canvas) return;

    if (
      modeRef.current === "freeform" &&
      canvas.getObjects().length > 0 &&
      !window.confirm(
        "استيراد PDF سيحوّل هذه اللوحة إلى وضع PDF وستفقد الرسومات الحالية. هل تريد المتابعة؟"
      )
    ) {
      e.target.value = "";
      return;
    }

    const imported = await importPdfPages(file);
    const newPages: PdfPageState[] = imported.map((p) => ({
      width: p.width,
      height: p.height,
      json: null,
      backgroundDataUrl: p.backgroundDataUrl,
    }));

    canvas.clear();
    canvas.setDimensions({
      width: newPages[0].width,
      height: newPages[0].height,
    });
    const img = await fabric.FabricImage.fromURL(
      newPages[0].backgroundDataUrl as string
    );
    canvas.backgroundImage = img;
    canvas.renderAll();
    newPages[0] = { ...newPages[0], json: canvas.toObject(EXTRA_PROPS) };

    modeRef.current = "pdf";
    pagesRef.current = newPages;
    currentPageIndexRef.current = 0;
    setMode("pdf");
    setPages(newPages);
    setCurrentPageIndex(0);
    refreshLayers();
    refreshVoiceNotes();
    history.reset(JSON.stringify(canvas.toObject(EXTRA_PROPS)));
    persist();
    e.target.value = "";
  };

  const handleExportPDF = async () => {
    const canvas = fabricRef.current;
    if (!canvas || modeRef.current !== "pdf") return;

    const currentIndex = currentPageIndexRef.current;
    const updatedPages = [...pagesRef.current];
    updatedPages[currentIndex] = {
      ...updatedPages[currentIndex],
      json: canvas.toObject(EXTRA_PROPS),
    };

    const blob = await exportPagesAsPdf(updatedPages, async (index) => {
      if (index === currentIndex) {
        return canvas.toDataURL({ format: "png", multiplier: 2 });
      }
      return renderPageOffscreen(updatedPages[index]);
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${board.name}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const goToPage = async (index: number) => {
    const canvas = fabricRef.current;
    if (!canvas || index === currentPageIndexRef.current) return;

    const currentIndex = currentPageIndexRef.current;
    const updatedPages = [...pagesRef.current];
    updatedPages[currentIndex] = {
      ...updatedPages[currentIndex],
      json: canvas.toObject(EXTRA_PROPS),
    };

    const target = updatedPages[index];
    canvas.clear();
    canvas.setDimensions({ width: target.width, height: target.height });

    if (target.json) {
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(target.json as Record<string, unknown>, () => resolve());
      });
    } else if (target.backgroundDataUrl) {
      const img = await fabric.FabricImage.fromURL(target.backgroundDataUrl);
      canvas.backgroundImage = img;
      updatedPages[index] = {
        ...updatedPages[index],
        json: canvas.toObject(EXTRA_PROPS),
      };
    }
    canvas.renderAll();

    pagesRef.current = updatedPages;
    currentPageIndexRef.current = index;
    setPages(updatedPages);
    setCurrentPageIndex(index);
    refreshLayers();
    refreshVoiceNotes();
    history.reset(JSON.stringify(canvas.toObject(EXTRA_PROPS)));
    persist();
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
    const cx = canvas.getWidth() / 2;
    const cy = canvas.getHeight() / 2;
    const objects = buildTemplate(id, cx, cy);
    const info = TEMPLATES.find((t) => t.id === id);

    // القالب بالكامل طبقة واحدة قابلة للتحريك والتحجيم ككتلة واحدة
    const group = new fabric.Group(objects, {});
    const anyGroup = group as fabric.Object & {
      id?: string;
      name?: string;
      kind?: IconName;
    };
    anyGroup.id = crypto.randomUUID();
    anyGroup.name = info?.title ?? "قالب";
    anyGroup.kind = info?.icon ?? "templates";

    attachNestedTextEditing(group, () => {
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      snapshot();
    });

    canvas.add(group);
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
    videoCanvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoCanvasStreamRef.current = null;
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

  const handleStartLiveVideo = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      canvas.discardActiveObject();
      canvas.renderAll();
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      videoMicStreamRef.current = micStream;

      const canvasEl = canvas.getElement();
      const canvasStream = canvasEl.captureStream(30);
      videoCanvasStreamRef.current = canvasStream;

      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...micStream.getAudioTracks(),
      ]);

      const mimeType = pickVideoMimeType();
      videoMimeTypeRef.current = mimeType;
      videoChunksRef.current = [];
      const recorder = new MediaRecorder(
        combined,
        mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : undefined
      );
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };
      recorder.onstop = finalizeVideoRecording;
      videoRecorderRef.current = recorder;
      recorder.start();
      setVideoStatus("recording");
      setVideoElapsed(0);
      videoTimerRef.current = setInterval(() => {
        setVideoElapsed((e) => e + 1);
      }, 1000);
      videoMaxTimeoutRef.current = setTimeout(() => {
        videoRecorderRef.current?.stop();
      }, MAX_VIDEO_SECONDS * 1000);
    } catch {
      alert("تعذّر الوصول إلى المايكروفون. تأكد من منح الإذن للموقع.");
    }
  };

  const handleStartReplay = async (speed: 1 | 2 | 4) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const steps = sessionStepsRef.current;
    if (steps.length < 2) return;

    const savedJSON = canvas.toObject(EXTRA_PROPS);
    canvas.discardActiveObject();

    const canvasEl = canvas.getElement();
    const canvasStream = canvasEl.captureStream(30);
    videoCanvasStreamRef.current = canvasStream;

    const mimeType = pickVideoMimeType();
    videoMimeTypeRef.current = mimeType;
    videoChunksRef.current = [];
    const recorder = new MediaRecorder(
      canvasStream,
      mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : undefined
    );
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };

    videoCancelReplayRef.current = false;
    videoRecorderRef.current = recorder;

    recorder.onstop = () => {
      canvas.loadFromJSON(savedJSON as Record<string, unknown>, () => {
        canvas.renderAll();
        refreshLayers();
        refreshVoiceNotes();
        finalizeVideoRecording();
      });
    };

    recorder.start();
    setVideoStatus("replaying");
    setVideoElapsed(0);
    videoTimerRef.current = setInterval(() => {
      setVideoElapsed((e) => e + 1);
    }, 1000);
    videoMaxTimeoutRef.current = setTimeout(() => {
      videoRecorderRef.current?.stop();
    }, MAX_VIDEO_SECONDS * 1000);

    for (let i = 0; i < steps.length; i++) {
      if (videoCancelReplayRef.current) break;
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(steps[i].json as Record<string, unknown>, () =>
          resolve()
        );
      });
      canvas.renderAll();
      let delay = 500;
      if (i > 0) {
        const rawDelta = steps[i].t - steps[i - 1].t;
        delay = Math.min(Math.max(rawDelta, 150), 2000) / speed;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!videoCancelReplayRef.current) recorder.stop();
  };

  const handleStopVideo = () => {
    if (videoStatus === "replaying") videoCancelReplayRef.current = true;
    videoRecorderRef.current?.stop();
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

  const handleZoomBy = (factor: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const center = new fabric.Point(
      canvas.getWidth() / 2,
      canvas.getHeight() / 2
    );
    const z = Math.min(Math.max(canvas.getZoom() * factor, 0.2), 4);
    canvas.zoomToPoint(center, z);
    setZoom(z);
  };

  const handleResetZoom = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
  };

  const canvasIsEmpty = mode === "freeform" && layers.length === 0;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-paper">
      <div
        ref={containerRef}
        className={`h-full w-full ${mode === "pdf" ? "overflow-auto" : ""}`}
        style={
          mode === "freeform"
            ? {
                backgroundImage:
                  "radial-gradient(var(--color-border-strong) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }
            : undefined
        }
      >
        {mode === "pdf" ? (
          <div className="flex min-h-full items-start justify-center p-6 pt-28">
            <canvas ref={canvasElRef} />
          </div>
        ) : (
          <canvas ref={canvasElRef} />
        )}
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

      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
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
        onToggleLayers={() => setLayersOpen((v) => !v)}
        layersOpen={layersOpen}
        canGroup={selectionKind === "multi"}
        canUngroup={selectionKind === "userGroup"}
        onGroup={handleGroupSelection}
        onUngroup={handleUngroupSelection}
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

      <ZoomControl
        zoom={zoom}
        onZoomIn={() => handleZoomBy(1.15)}
        onZoomOut={() => handleZoomBy(1 / 1.15)}
        onReset={handleResetZoom}
      />

      {mode === "pdf" && (
        <PageNavigator
          pages={pages}
          currentIndex={currentPageIndex}
          onSelect={goToPage}
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

function createStar(
  cx: number,
  cy: number,
  radius: number,
  color: string,
  strokeWidth: number,
  opacity: number
) {
  const points = 5;
  const outerRadius = radius;
  const innerRadius = radius / 2.5;
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
  }
  const star = new fabric.Polygon(coords, {
    left: cx - outerRadius,
    top: cy - outerRadius,
    fill: "transparent",
    stroke: color,
    strokeWidth,
    opacity,
  });
  (star as fabric.Object & { isStar?: boolean }).isStar = true;
  return star;
}
