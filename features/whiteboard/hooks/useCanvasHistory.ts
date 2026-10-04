import { useCallback, useRef } from "react";

const MAX_HISTORY = 40;

export function useCanvasHistory() {
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const suppressRef = useRef(false);

  const isSuppressed = () => suppressRef.current;

  const push = useCallback((json: string) => {
    if (suppressRef.current) return;
    undoStack.current.push(json);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    redoStack.current = [];
  }, []);

  const undo = useCallback((currentJSON: string): string | null => {
    const previous = undoStack.current.pop();
    if (!previous) return null;
    redoStack.current.push(currentJSON);
    return previous;
  }, []);

  const redo = useCallback((currentJSON: string): string | null => {
    const next = redoStack.current.pop();
    if (!next) return null;
    undoStack.current.push(currentJSON);
    return next;
  }, []);

  const setSuppressed = useCallback((value: boolean) => {
    suppressRef.current = value;
  }, []);

  const reset = useCallback((seedJSON: string) => {
    undoStack.current = [seedJSON];
    redoStack.current = [];
  }, []);

  return { push, undo, redo, setSuppressed, isSuppressed, reset };
}
