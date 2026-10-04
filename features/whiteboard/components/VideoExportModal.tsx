"use client";

import { useState } from "react";
import { Icon } from "@/features/shared/icons/Icon";

export type VideoExportStatus =
  | "idle"
  | "recording"
  | "replaying"
  | "recorded";

interface VideoExportModalProps {
  status: VideoExportStatus;
  elapsedSeconds: number;
  previewUrl: string | null;
  canReplay: boolean;
  onStartLive: () => void;
  onStop: () => void;
  onStartReplay: (speed: 1 | 2 | 4) => void;
  onDownload: () => void;
  onDiscard: () => void;
  onClose: () => void;
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

export function VideoExportModal({
  status,
  elapsedSeconds,
  previewUrl,
  canReplay,
  onStartLive,
  onStop,
  onStartReplay,
  onDownload,
  onDiscard,
  onClose,
}: VideoExportModalProps) {
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);

  const busy = status === "recording" || status === "replaying";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="w-96 rounded-2xl border border-border bg-surface p-6 shadow-panel-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon name="video" size={17} className="text-accent" />
            تصدير فيديو الشرح
          </h3>
          {!busy && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-paper hover:text-ink"
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        {status === "idle" && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <Icon name="record" size={14} className="text-danger" />
                تسجيل مباشر
              </p>
              <p className="mb-3 text-xs text-ink-faint">
                يسجّل اللوحة لحظيًا مع صوت المايكروفون (حتى 10 دقائق)
              </p>
              <button
                onClick={onStartLive}
                className="w-full rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                ابدأ التسجيل المباشر
              </button>
            </div>

            <div className="h-px bg-border" />

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <Icon name="redo" size={14} className="text-accent" />
                إعادة تشغيل تلقائي
              </p>
              <p className="mb-3 text-xs text-ink-faint">
                يعيد رسم خطوات هذه الجلسة تلقائيًا ويسجلها كفيديو
              </p>
              <div className="mb-3 flex gap-2">
                {([1, 2, 4] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${
                      speed === s
                        ? "border-ink bg-ink text-surface"
                        : "border-border text-ink-soft hover:bg-paper"
                    }`}
                  >
                    ×{s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onStartReplay(speed)}
                disabled={!canReplay}
                className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ابدأ إعادة التشغيل والتسجيل
              </button>
              {!canReplay && (
                <p className="mt-2 text-xs text-ink-faint">
                  ارسم بضع خطوات على اللوحة أولًا لتفعيل إعادة التشغيل
                </p>
              )}
            </div>
          </div>
        )}

        {status === "recording" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="h-3 w-3 animate-pulse rounded-full bg-danger" />
            <span className="font-mono text-2xl text-ink">
              {formatTime(elapsedSeconds)}
            </span>
            <p className="text-xs text-ink-faint">جارِ التسجيل المباشر...</p>
            <button
              onClick={onStop}
              className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface hover:bg-ink/90"
            >
              <Icon name="stop" size={14} />
              إيقاف التسجيل
            </button>
          </div>
        )}

        {status === "replaying" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ink" />
            <span className="font-mono text-2xl text-ink">
              {formatTime(elapsedSeconds)}
            </span>
            <p className="text-xs text-ink-faint">
              جارِ إعادة رسم خطوات الجلسة وتسجيلها... سينتهي تلقائيًا
            </p>
          </div>
        )}

        {status === "recorded" && previewUrl && (
          <div className="flex flex-col gap-3">
            <video controls src={previewUrl} className="w-full rounded-lg" />
            <button
              onClick={onDownload}
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface hover:bg-ink/90"
            >
              حفظ الفيديو
            </button>
            <button
              onClick={onDiscard}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink-soft hover:bg-paper"
            >
              تجاهل وإعادة المحاولة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
