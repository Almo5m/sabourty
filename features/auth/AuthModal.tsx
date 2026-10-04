"use client";

import { useState } from "react";
import { Icon } from "@/features/shared/icons/Icon";
import { useAuth } from "./AuthContext";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const result =
      tab === "signin"
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (tab === "signup") {
      setInfo("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده إن لزم الأمر.");
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="w-80 rounded-2xl border border-border bg-surface p-6 shadow-panel-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            {tab === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-paper hover:text-ink"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="mb-4 flex rounded-lg bg-paper p-1 text-xs">
          <button
            onClick={() => setTab("signin")}
            className={`flex-1 rounded-md py-1.5 ${
              tab === "signin" ? "bg-surface shadow-sm" : "text-ink-soft"
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => setTab("signup")}
            className={`flex-1 rounded-md py-1.5 ${
              tab === "signup" ? "bg-surface shadow-sm" : "text-ink-soft"
            }`}
          >
            حساب جديد
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />

          {error && <p className="text-xs text-danger">{error}</p>}
          {info && <p className="text-xs text-accent">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            {tab === "signin" ? "دخول" : "إنشاء الحساب"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-ink-faint">
          <div className="h-px flex-1 bg-border" />
          أو
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={signInWithGoogle}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm text-ink-soft hover:bg-paper"
        >
          <span className="flex items-center justify-center gap-2">
            <Icon name="google" size={16} />
            المتابعة عبر Google
          </span>
        </button>
      </div>
    </div>
  );
}
