import { useCallback, useRef } from "react";

const MAX_HISTORY = 40;

/**
 * يحتفظ بخط زمني واحد من اللقطات (states) مع مؤشر على الموضع الحالي،
 * بدل نظام "صفّين" (undo/redo) القديم اللي كان بيسبب خطأ إزاحة بمقدار
 * خطوة واحدة (التراجع كان بيرجّع نفس الحالة الحالية أول مرة، وبعدين
 * يقفز خطوة زيادة، وهو ده سبب اختفاء كل العناصر بعد كذا تراجع).
 */
export function useCanvasHistory() {
  const stackRef = useRef<string[]>([]);
  const indexRef = useRef<number>(-1);
  const suppressRef = useRef(false);

  const isSuppressed = () => suppressRef.current;

  const setSuppressed = useCallback((value: boolean) => {
    suppressRef.current = value;
  }, []);

  const push = useCallback((json: string) => {
    if (suppressRef.current) return;
    // اقطع أي فرع "إعادة" قديم لو كان المستخدم رجع بتراجع ثم عدّل من جديد
    const next = stackRef.current.slice(0, indexRef.current + 1);
    next.push(json);
    while (next.length > MAX_HISTORY) next.shift();
    stackRef.current = next;
    indexRef.current = next.length - 1;
  }, []);

  const undo = useCallback((): string | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    return stackRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): string | null => {
    if (indexRef.current >= stackRef.current.length - 1) return null;
    indexRef.current += 1;
    return stackRef.current[indexRef.current];
  }, []);

  const reset = useCallback((seedJSON: string) => {
    stackRef.current = [seedJSON];
    indexRef.current = 0;
  }, []);

  return { push, undo, redo, setSuppressed, isSuppressed, reset };
}
