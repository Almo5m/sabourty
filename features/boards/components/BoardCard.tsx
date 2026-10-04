"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/features/shared/icons/Icon";
import { BoardSummary } from "../types";

interface BoardCardProps {
  board: BoardSummary;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BoardCard({
  board,
  onRename,
  onDuplicate,
  onDelete,
}: BoardCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(board.name);

  const formattedDate = new Date(board.updatedAt).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel">
      <button
        onClick={() => router.push(`/board/${board.id}`)}
        className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-paper"
      >
        {board.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={board.thumbnail}
            alt={board.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <svg
              className="absolute inset-0 h-full w-full opacity-40"
              aria-hidden="true"
            >
              <pattern
                id={`dots-${board.id}`}
                width="16"
                height="16"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1.5" cy="1.5" r="1.5" fill="var(--color-border-strong)" />
              </pattern>
              <rect width="100%" height="100%" fill={`url(#dots-${board.id})`} />
            </svg>
            <Icon
              name="pen"
              size={26}
              className="relative text-ink-faint"
            />
          </>
        )}
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2.5">
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              onRename(board.id, nameDraft.trim() || board.name);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full rounded-md border border-border-strong px-2 py-1 text-sm"
          />
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {board.name}
            </p>
            <p className="text-xs text-ink-faint">{formattedDate}</p>
          </div>
        )}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-paper hover:text-ink"
          >
            <Icon name="more" size={15} />
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-9 z-10 w-40 overflow-hidden rounded-xl border border-border bg-surface py-1 text-sm shadow-panel-lg">
              <button
                onClick={() => {
                  setRenaming(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-ink-soft hover:bg-paper hover:text-ink"
              >
                <Icon name="rename" size={14} />
                إعادة تسمية
              </button>
              <button
                onClick={() => {
                  onDuplicate(board.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-ink-soft hover:bg-paper hover:text-ink"
              >
                <Icon name="duplicate" size={14} />
                نسخ
              </button>
              <button
                onClick={() => {
                  onDelete(board.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-danger-soft"
              >
                <Icon name="trash" size={14} />
                حذف
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
