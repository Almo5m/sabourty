"use client";

import { Icon } from "@/features/shared/icons/Icon";
import { TEMPLATES, TemplateId } from "../lib/templates";

interface TemplatesPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: TemplateId) => void;
}

export function TemplatesPanel({
  open,
  onClose,
  onSelect,
}: TemplatesPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="w-[480px] rounded-2xl border border-border bg-surface shadow-panel-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon name="templates" size={17} className="text-accent" />
            القوالب الجاهزة
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-paper hover:text-ink"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-right transition hover:border-accent hover:bg-accent-soft"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon name={template.icon} size={18} />
              </span>
              <span className="text-sm font-medium text-ink">
                {template.title}
              </span>
              <span className="text-xs text-ink-faint">
                {template.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
