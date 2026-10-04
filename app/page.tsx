"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BoardSummary } from "@/features/boards/types";
import {
  createBoard,
  deleteBoard,
  duplicateBoard,
  listBoards,
  renameBoard,
} from "@/features/boards/lib/boardStorage";
import { syncBoards } from "@/features/boards/lib/sync";
import { BoardCard } from "@/features/boards/components/BoardCard";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthModal } from "@/features/auth/AuthModal";
import { Icon, Logomark } from "@/features/shared/icons/Icon";

export default function HomePage() {
  const router = useRouter();
  const { user, configured, signOut } = useAuth();
  const [boards, setBoards] = useState<BoardSummary[]>(() =>
    typeof window === "undefined" ? [] : listBoards()
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");

  const runSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await syncBoards(user.id);
      setBoards(listBoards());
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return boards;
    return boards.filter((b) => b.name.includes(q));
  }, [boards, query]);

  const handleCreate = () => {
    const board = createBoard(`لوحة بدون عنوان ${boards.length + 1}`);
    router.push(`/board/${board.id}`);
  };

  const handleRename = (id: string, name: string) => {
    renameBoard(id, name);
    setBoards(listBoards());
  };

  const handleDuplicate = (id: string) => {
    duplicateBoard(id);
    setBoards(listBoards());
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("هل تريد حذف هذه اللوحة نهائيًا؟")) return;
    deleteBoard(id);
    setBoards(listBoards());
  };

  const accountBlock = configured ? (
    user ? (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="user" size={15} />
          </span>
          <span className="truncate text-xs text-ink-soft">{user.email}</span>
        </div>
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-paper disabled:opacity-50"
        >
          <Icon name="cloud" size={16} />
          {syncing ? "جارِ المزامنة..." : "مزامنة الآن"}
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-faint hover:bg-paper hover:text-ink-soft"
        >
          <Icon name="logout" size={16} />
          تسجيل الخروج
        </button>
      </div>
    ) : (
      <button
        onClick={() => setAuthOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm text-ink-soft hover:bg-paper hover:text-ink"
      >
        <Icon name="user" size={16} />
        تسجيل الدخول
      </button>
    )
  ) : (
    <p className="rounded-xl bg-paper px-3 py-2.5 text-xs leading-relaxed text-ink-faint">
      لوحاتك محفوظة على جهازك. فعّل الحسابات لنسخها احتياطيًا في السحابة.
    </p>
  );

  return (
    <div className="flex min-h-screen bg-paper">
      {/* الشريط الجانبي */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-e border-border bg-surface p-5 md:flex">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <Logomark size={38} />
            <div>
              <p className="text-base font-bold leading-tight text-ink">
                سبورتي
              </p>
              <p className="text-xs text-ink-faint">مساحتك البيضاء للأفكار</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            <button className="flex items-center gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent-strong">
              <Icon name="layers" size={17} />
              كل اللوحات
              <span className="ms-auto text-xs text-accent">
                {boards.length}
              </span>
            </button>
          </nav>
        </div>

        <div>{accountBlock}</div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="min-w-0 flex-1">
        {/* شريط علوي للجوال */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <div className="flex items-center gap-2.5">
            <Logomark size={30} />
            <span className="font-bold text-ink">سبورتي</span>
          </div>
          {configured && !user && (
            <button
              onClick={() => setAuthOpen(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-ink-soft"
            >
              تسجيل الدخول
            </button>
          )}
        </div>

        <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink">لوحاتك</h1>
              <p className="mt-1 text-sm text-ink-soft">
                كل تعديل يُحفظ تلقائيًا، وتقدر ترجع لأي لوحة في أي وقت
              </p>
            </div>

            <div className="flex w-full items-center gap-3 sm:w-auto">
              <div className="relative flex-1 sm:w-64 sm:flex-none">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث عن لوحة"
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
              </div>
              <button
                onClick={handleCreate}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-strong"
              >
                <Icon name="plus" size={16} />
                لوحة جديدة
              </button>
            </div>
          </header>

          {boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-20 text-center">
              <svg
                width="120"
                height="88"
                viewBox="0 0 120 88"
                fill="none"
                aria-hidden="true"
                className="mb-6"
              >
                <rect
                  x="8"
                  y="8"
                  width="104"
                  height="64"
                  rx="10"
                  fill="#faf9f5"
                  stroke="#d8d1bd"
                  strokeWidth="2"
                />
                <path
                  d="M28 52c8-14 14 6 22-6s12 2 20-10 14 4 22-8"
                  stroke="#1f6f63"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="94" cy="24" r="4" fill="#d98c3b" />
                <path
                  d="M48 72v8M72 72v8M40 80h40"
                  stroke="#d8d1bd"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <h2 className="mb-1 text-lg font-semibold text-ink">
                ابدأ أول لوحة
              </h2>
              <p className="mb-6 max-w-sm text-sm text-ink-soft">
                لوحة بيضاء مفتوحة للرسم والكتابة والشرح. ارسم فكرة، أو استورد
                ملف PDF واكتب فوقه.
              </p>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
              >
                <Icon name="plus" size={16} />
                لوحة جديدة
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-faint">
              لا توجد لوحة بهذا الاسم
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
