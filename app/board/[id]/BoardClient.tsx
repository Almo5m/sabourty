"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BoardData } from "@/features/boards/types";
import { createBoard, getBoard } from "@/features/boards/lib/boardStorage";
import { pushBoardToCloud } from "@/features/boards/lib/sync";
import { useAuth } from "@/features/auth/AuthContext";

const WhiteboardCanvas = dynamic(
  () =>
    import("@/features/whiteboard/components/WhiteboardCanvas").then(
      (m) => m.WhiteboardCanvas
    ),
  { ssr: false }
);

export function BoardClient({ boardId }: { boardId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  // نبدأ بحالة "جارِ التحميل" (نفس ما يرسمه السيرفر) ونقرأ اللوحة بعد التركيب،
  // وإلا يحصل عدم تطابق هيدرشن (خطأ React #418).
  const [board, setBoard] = useState<BoardData | null | "loading">("loading");

  useEffect(() => {
    const existing = getBoard(boardId) ?? createBoard("لوحة بدون عنوان");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBoard(existing);
  }, [boardId]);

  const resolvedIdRef = useRef<string>(boardId);
  useEffect(() => {
    if (board !== "loading" && board) resolvedIdRef.current = board.id;
  }, [board]);

  useEffect(() => {
    if (board !== "loading" && board && board.id !== boardId) {
      router.replace(`/board/${board.id}`);
    }
  }, [board, boardId, router]);

  useEffect(() => {
    return () => {
      const uid = userIdRef.current;
      if (uid) pushBoardToCloud(uid, resolvedIdRef.current);
    };
  }, []);

  if (board === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-ink-faint">
        جارِ التحميل...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-ink-faint">
        <p>هذه اللوحة غير موجودة</p>
        <Link href="/" className="text-sm text-ink underline">
          الرجوع للوحاتي
        </Link>
      </div>
    );
  }

  return (
    <WhiteboardCanvas board={board} />
  );
}
