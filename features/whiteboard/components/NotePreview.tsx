"use client";

import { NodeLook } from "../objects/nodeLooks";

/** معاينة مصغّرة لمظهر ملاحظة (بتتستخدم في قوائم الاختيار). */
export function NotePreview({ look, fill, accent }: { look: NodeLook; fill: string; accent: string }) {
  const base = "relative h-11 w-14 overflow-hidden";
  if (look === "card")
    return (
      <div className={`${base} rounded-lg border border-border bg-white shadow-sm`}>
        <div className="h-1.5 w-full" style={{ background: accent }} />
      </div>
    );
  if (look === "flat") return <div className={`${base} rounded-xl`} style={{ background: fill }} />;
  if (look === "outline")
    return (
      <div
        className={`${base} rounded-xl border-2`}
        style={{ borderColor: accent, background: `${fill}66` }}
      />
    );
  return (
    <div className={`${base} shadow-md`} style={{ background: fill }}>
      {look === "tape" && (
        <div className="absolute inset-x-3 top-0.5 h-2 -rotate-2 opacity-60" style={{ background: accent }} />
      )}
      <div
        className="absolute bottom-0 start-0 h-3 w-3"
        style={{ background: "rgba(0,0,0,0.13)", clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
      />
    </div>
  );
}

