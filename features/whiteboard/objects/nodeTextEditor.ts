import * as fabric from "fabric";
import type { NodeObject } from "./node";

/** اسم الخط بشكل صالح لـ CSS (الأسماء اللي فيها مسافات أو أرقام لازم تتحط بين علامات تنصيص). */
export function cssFontFamily(family: string): string {
  return /['",]/.test(family) ? family : `"${family}", sans-serif`;
}

export interface EditorHooks {
  /** اتنادت لما التحرير يخلص وفي تغيير فعلي في النص */
  onCommit(node: NodeObject): void;
  onEditingChange(editing: boolean): void;
}

/**
 * محرّر نص العقد: عنصر <textarea> حقيقي فوق الكانفا بنفس الخط والحجم والمحاذاة.
 * اخترناه بدل محرّر فابريك الداخلي لأن حقل النص الأصلي بيشتغل أحسن بكتير مع كيبورد
 * التابلت والموبايل والكتابة العربية (IME)، وبيدعم التحديد والنسخ واللصق طبيعي.
 */
export class NodeTextEditor {
  private readonly el: HTMLTextAreaElement;
  private node: NodeObject | null = null;
  private original = "";
  private readonly onAfterRender = () => this.reposition();

  constructor(
    private readonly canvas: fabric.Canvas,
    private readonly hooks: EditorHooks
  ) {
    const el = document.createElement("textarea");
    el.setAttribute("dir", "auto");
    el.setAttribute("aria-label", "نص العقدة");
    el.setAttribute("data-node-editor", "true");
    el.spellcheck = false;
    Object.assign(el.style, {
      position: "absolute",
      display: "none",
      margin: "0",
      padding: "0",
      border: "none",
      outline: "none",
      resize: "none",
      overflow: "hidden",
      background: "transparent",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      unicodeBidi: "plaintext",
      zIndex: "5",
      transformOrigin: "50% 50%",
    });
    el.addEventListener("input", this.onInput);
    el.addEventListener("keydown", this.onKeyDown);
    el.addEventListener("blur", this.onBlur);
    // اللمس جوه المحرّر ما يوصلش للكانفا (وإلا بيحصل تحديد/سحب أثناء الكتابة)
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    canvas.wrapperEl.appendChild(el);
    this.el = el;
  }

  get isOpen() {
    return this.node !== null;
  }

  get editingNode() {
    return this.node;
  }

  open(node: NodeObject, selectAll = false) {
    if (this.node === node) {
      this.el.focus();
      return;
    }
    this.close(true);
    this.node = node;
    this.original = node.label;
    node.editing = true;
    node.dirty = true;
    this.el.value = node.label;
    this.el.style.display = "block";
    this.canvas.on("after:render", this.onAfterRender);
    this.hooks.onEditingChange(true);
    this.canvas.requestRenderAll();
    this.reposition();
    // focus مباشرة جوه نفس اللمسة عشان كيبورد الموبايل يظهر
    this.el.focus({ preventScroll: true });
    if (selectAll) this.el.select();
    else this.el.setSelectionRange(this.el.value.length, this.el.value.length);
  }

  close(commit: boolean) {
    const node = this.node;
    if (!node) return;
    this.node = null;
    this.canvas.off("after:render", this.onAfterRender);
    this.el.style.display = "none";
    this.el.blur();
    node.editing = false;
    if (!commit) node.patch({ label: this.original });
    node.dirty = true;
    this.canvas.requestRenderAll();
    this.hooks.onEditingChange(false);
    if (commit && node.label !== this.original) this.hooks.onCommit(node);
  }

  destroy() {
    this.close(true);
    this.el.remove();
  }

  private readonly onInput = () => {
    const node = this.node;
    if (!node) return;
    node.patch({ label: this.el.value });
    this.canvas.requestRenderAll();
    this.reposition();
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      this.close(true);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.close(true);
    }
  };

  private readonly onBlur = () => {
    // بنأجّل شوية عشان لو الضغطة كانت على زرار في الواجهة ما نقفلش قبل ما يتنفذ
    window.setTimeout(() => {
      if (this.node && document.activeElement !== this.el) this.close(true);
    }, 0);
  };

  /** يظبط مكان وحجم الحقل فوق نص العقدة بالظبط (مع التكبير والدوران). */
  reposition() {
    const node = this.node;
    if (!node) return;
    const el = this.el;
    const zoom = this.canvas.getZoom();
    const rect = node.getTextRect();
    const matrix = fabric.util.multiplyTransformMatrices(
      this.canvas.viewportTransform,
      node.calcTransformMatrix()
    );
    const center = fabric.util.transformPoint(
      new fabric.Point(rect.x + rect.w / 2, rect.y + rect.h / 2),
      matrix
    );
    const nodeScale = Math.hypot(matrix[0], matrix[1]);

    el.style.width = `${rect.w * nodeScale}px`;
    el.style.fontFamily = cssFontFamily(node.fontFamily);
    el.style.fontSize = `${node.fontSize * nodeScale}px`;
    el.style.fontWeight = node.fontWeight;
    el.style.fontStyle = node.fontStyle;
    el.style.lineHeight = String(node.lineHeight);
    el.style.textAlign = node.textAlign;
    el.style.color = node.resolvedTextColor;
    el.style.caretColor = node.resolvedTextColor;

    el.style.height = "auto";
    const contentHeight = Math.min(el.scrollHeight, rect.h * nodeScale);
    el.style.height = `${Math.max(contentHeight, node.fontSize * node.lineHeight * nodeScale)}px`;

    let offsetY = 0;
    const free = rect.h * nodeScale - el.offsetHeight;
    if (node.verticalAlign === "top") offsetY = -free / 2;
    else if (node.verticalAlign === "bottom") offsetY = free / 2;

    const angle = node.getTotalAngle();
    el.style.left = `${center.x}px`;
    el.style.top = `${center.y}px`;
    el.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(${offsetY}px)`;
    void zoom;
  }
}
