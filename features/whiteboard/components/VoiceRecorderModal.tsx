"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/features/shared/icons/Icon";
import { pickRecorderMimeType } from "../lib/audioStorage";

interface VoiceRecorderModalProps {
  onCancel: () => void;
  onSave: (blob: Blob, durationSeconds: number) => void;
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

export function VoiceRecorderModal({
  onCancel,
  onSave,
}: VoiceRecorderModalProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "recorded">(
    "idle"
  );
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };

  useEffect(() => cleanup, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType
          ? { mimeType, audioBitsPerSecond: 64000 }
          : { audioBitsPerSecond: 64000 }
      );
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("recorded");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } catch {
      setError("تعذّر الوصول إلى المايكروفون. تأكد من منح الإذن للموقع.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const discardAndRerecord = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setStatus("idle");
    setElapsed(0);
  };

  const handleSave = () => {
    if (!blobRef.current) return;
    onSave(blobRef.current, elapsed);
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="w-80 rounded-2xl border border-border bg-surface p-6 shadow-panel-lg">
        <h3 className="mb-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-ink">
          <Icon name="voice" size={17} className="text-accent" />
          ملاحظة صوتية
        </h3>

        {error && (
          <p className="mb-3 text-center text-xs text-danger">{error}</p>
        )}

        <div className="mb-5 flex flex-col items-center gap-3">
          {status === "recording" && (
            <span className="h-3 w-3 animate-pulse rounded-full bg-danger" />
          )}
          <span className="font-mono text-2xl text-ink">
            {formatTime(elapsed)}
          </span>

          {status === "recorded" && previewUrl && (
            <audio controls src={previewUrl} className="w-full" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          {status === "idle" && (
            <button
              onClick={startRecording}
              className="flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <Icon name="record" size={15} />
              ابدأ التسجيل
            </button>
          )}
          {status === "recording" && (
            <button
              onClick={stopRecording}
              className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface hover:bg-ink/90"
            >
              <Icon name="stop" size={15} />
              إيقاف
            </button>
          )}
          {status === "recorded" && (
            <>
              <button
                onClick={handleSave}
                className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-surface hover:bg-ink/90"
              >
                حفظ الملاحظة
              </button>
              <button
                onClick={discardAndRerecord}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink-soft hover:bg-paper"
              >
                إعادة التسجيل
              </button>
            </>
          )}
          <button
            onClick={handleCancel}
            className="rounded-xl px-4 py-2 text-xs text-ink-faint hover:text-ink-soft"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
