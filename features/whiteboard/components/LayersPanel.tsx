"use client";

import { useState } from "react";
import { Icon } from "@/features/shared/icons/Icon";
import { LayerItem } from "../types";

interface LayersPanelProps {
  open: boolean;
  layers: LayerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIdsBottomToTop: string[]) => void;
}

export function LayersPanel({
  open,
  layers,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
  onReorder,
}: LayersPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  if (!open) return null;

  const stop = (
    e: React.MouseEvent,
    action: () => void
  ) => {
    e.stopPropagation();
    action();
  };

  // القائمة معروضة من الأعلى (العنصر الأقرب للمقدمة) للأسفل
  const displayOrder = [...layers].reverse();

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const ids = displayOrder.map((l) => l.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    // القائمة المعروضة من الأعلى للأسفل، والطبقات الفعلية من الأسفل للأعلى
    onReorder([...ids].reverse());
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="pointer-events-none absolute start-4 top-20 bottom-4 z-20 flex w-64">
      <div className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-panel">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Icon name="layers" size={16} className="text-ink-soft" />
          <h2 className="text-sm font-semibold text-ink">الطبقات</h2>
          <span className="ms-auto text-xs text-ink-faint">
            {layers.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {layers.length === 0 ? (
            <p className="p-5 text-center text-xs text-ink-faint">
              لا توجد عناصر بعد — ابدأ الرسم على اللوحة
            </p>
          ) : (
            displayOrder.map((layer) => {
              const active = layer.id === selectedId;
              const isOver = overId === layer.id && dragId !== layer.id;
              return (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={() => setDragId(layer.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overId !== layer.id) setOverId(layer.id);
                  }}
                  onDragLeave={() => {
                    if (overId === layer.id) setOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(layer.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onClick={() => onSelect(layer.id)}
                  className={`group flex cursor-grab items-center gap-1.5 border-t-2 px-2.5 py-1.5 text-xs active:cursor-grabbing ${
                    isOver ? "border-t-accent" : "border-t-transparent"
                  } ${active ? "bg-accent-soft" : "hover:bg-paper"}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center ${
                      active ? "text-accent-strong" : "text-ink-faint"
                    }`}
                  >
                    <Icon name={layer.icon} size={14} />
                  </span>

                  <button
                    onClick={(e) => stop(e, () => onToggleVisible(layer.id))}
                    title={layer.visible ? "إخفاء" : "إظهار"}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface hover:text-ink"
                  >
                    <Icon name={layer.visible ? "eye" : "eyeOff"} size={14} />
                  </button>
                  <button
                    onClick={(e) => stop(e, () => onToggleLock(layer.id))}
                    title={layer.locked ? "فتح القفل" : "قفل"}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface hover:text-ink"
                  >
                    <Icon name={layer.locked ? "lock" : "unlock"} size={14} />
                  </button>

                  {editingId === layer.id ? (
                    <input
                      autoFocus
                      value={draft}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => {
                        onRename(layer.id, draft.trim() || layer.name);
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className="min-w-0 flex-1 rounded border border-border-strong px-1 py-0.5"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingId(layer.id);
                        setDraft(layer.name);
                      }}
                      className={`min-w-0 flex-1 truncate ${
                        active ? "text-accent-strong" : "text-ink"
                      }`}
                    >
                      {layer.name}
                    </span>
                  )}

                  <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => stop(e, () => onMoveUp(layer.id))}
                      title="لأعلى"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-surface hover:text-ink"
                    >
                      <Icon name="chevronUp" size={13} />
                    </button>
                    <button
                      onClick={(e) => stop(e, () => onMoveDown(layer.id))}
                      title="لأسفل"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-surface hover:text-ink"
                    >
                      <Icon name="chevronDown" size={13} />
                    </button>
                    <button
                      onClick={(e) => stop(e, () => onDelete(layer.id))}
                      title="حذف"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-danger hover:bg-danger-soft"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
