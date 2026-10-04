"use client";

import { Icon } from "@/features/shared/icons/Icon";
import { VoiceNoteMeta } from "../types";

interface VoiceNotesPanelProps {
  open: boolean;
  notes: VoiceNoteMeta[];
  onClose: () => void;
  onPlay: (audioNoteId: string) => void;
  onRerecord: (objectId: string) => void;
  onDelete: (objectId: string) => void;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceNotesPanel({
  open,
  notes,
  onClose,
  onPlay,
  onRerecord,
  onDelete,
}: VoiceNotesPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="flex max-h-[70vh] w-96 flex-col rounded-2xl border border-border bg-surface shadow-panel-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon name="voiceList" size={17} className="text-accent" />
            الملاحظات الصوتية
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-paper hover:text-ink"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {notes.length === 0 ? (
            <p className="p-6 text-center text-xs text-ink-faint">
              لا توجد ملاحظات صوتية على هذه اللوحة بعد
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((note) => (
                <li
                  key={note.objectId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{note.name}</p>
                    <p className="text-xs text-ink-faint">
                      {formatTime(note.durationSeconds)} ·{" "}
                      {new Date(note.recordedAt).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => onPlay(note.audioNoteId)}
                      title="تشغيل"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-ink"
                    >
                      <Icon name="play" size={14} />
                    </button>
                    <button
                      onClick={() => onRerecord(note.objectId)}
                      title="إعادة تسجيل"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft hover:bg-accent-soft hover:text-ink"
                    >
                      <Icon name="voice" size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(note.objectId)}
                      title="حذف"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
