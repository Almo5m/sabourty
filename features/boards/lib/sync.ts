import { supabase } from "@/lib/supabaseClient";
import {
  getBoard,
  getBoardThumbnail,
  listBoards,
  upsertLocalBoardFromRemote,
} from "./boardStorage";
import { BoardData } from "../types";

interface RemoteBoardRow {
  id: string;
  name: string;
  mode: string;
  canvas_json: unknown;
  pdf_pages: unknown;
  current_page_index: number;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

function remoteToLocal(row: RemoteBoardRow): BoardData {
  return {
    id: row.id,
    name: row.name,
    canvasJSON: row.canvas_json,
    mode: row.mode === "pdf" ? "pdf" : "freeform",
    pdfPages: Array.isArray(row.pdf_pages) ? row.pdf_pages : [],
    currentPageIndex: row.current_page_index ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as BoardData;
}

export async function pushBoardToCloud(userId: string, boardId: string) {
  if (!supabase) return;
  const board = getBoard(boardId);
  if (!board) return;
  const thumbnail = getBoardThumbnail(boardId);

  await supabase.from("boards").upsert({
    id: board.id,
    user_id: userId,
    name: board.name,
    mode: board.mode,
    canvas_json: board.canvasJSON,
    pdf_pages: board.pdfPages,
    current_page_index: board.currentPageIndex,
    thumbnail,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  });
}

/** Full two-way sync: pulls newer/missing remote boards into local storage,
 * then pushes newer/missing local boards up to the cloud. Last-write-wins
 * per board, based on updatedAt. */
export async function syncBoards(userId: string): Promise<void> {
  if (!supabase) return;

  const { data: remoteRows, error } = await supabase
    .from("boards")
    .select("*")
    .eq("user_id", userId);

  const remoteById = new Map<string, RemoteBoardRow>();
  if (!error && remoteRows) {
    for (const row of remoteRows as RemoteBoardRow[]) {
      remoteById.set(row.id, row);
    }
  }

  const localSummaries = listBoards();
  const localById = new Map(localSummaries.map((s) => [s.id, s]));

  // Pull: remote boards that are missing locally or newer than the local copy.
  for (const row of remoteById.values()) {
    const localSummary = localById.get(row.id);
    const remoteUpdatedAt = new Date(row.updated_at).getTime();
    const localUpdatedAt = localSummary
      ? new Date(localSummary.updatedAt).getTime()
      : -1;
    if (!localSummary || remoteUpdatedAt > localUpdatedAt) {
      upsertLocalBoardFromRemote(remoteToLocal(row), row.thumbnail);
    }
  }

  // Push: local boards that are missing remotely or newer than the remote copy.
  for (const summary of listBoards()) {
    const row = remoteById.get(summary.id);
    const localUpdatedAt = new Date(summary.updatedAt).getTime();
    const remoteUpdatedAt = row ? new Date(row.updated_at).getTime() : -1;
    if (!row || localUpdatedAt > remoteUpdatedAt) {
      await pushBoardToCloud(userId, summary.id);
    }
  }
}
