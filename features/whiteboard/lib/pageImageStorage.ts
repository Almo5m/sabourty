/**
 * تخزين صور صفحات الـ PDF في IndexedDB.
 *
 * ليه مش localStorage؟ حدّه حوالي 5MB، وصفحة PDF واحدة مرسومة بـ 1600px
 * بتاخد مئات الكيلوبايتات، فملف بـ 15 صفحة كان بيفشل في الحفظ. IndexedDB بيخزّن
 * الصور كـ Blob (بدون تحويل لنص) وحدّه بالمئات من الميجابايت.
 */

const DB_NAME = "sabourty-pdf-pages";
const DB_VERSION = 1;
const STORE = "images";

const keyOf = (boardId: string, pageIndex: number) => `${boardId}:${pageIndex}`;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(request ? (request.result as T) : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

export async function savePageImage(
  boardId: string,
  pageIndex: number,
  image: Blob
): Promise<void> {
  await runTransaction("readwrite", (store) => {
    store.put(image, keyOf(boardId, pageIndex));
  });
}

export async function savePageImages(
  boardId: string,
  images: Blob[]
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    images.forEach((image, index) => store.put(image, keyOf(boardId, index)));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

export async function getPageImage(
  boardId: string,
  pageIndex: number
): Promise<Blob | null> {
  const result = await runTransaction<Blob | undefined>("readonly", (store) =>
    store.get(keyOf(boardId, pageIndex))
  );
  return result ?? null;
}

export async function deleteBoardPageImages(boardId: string): Promise<void> {
  await runTransaction("readwrite", (store) => {
    store.delete(IDBKeyRange.bound(`${boardId}:`, `${boardId}:\uffff`));
  });
}

export async function copyBoardPageImages(
  fromBoardId: string,
  toBoardId: string,
  pageCount: number
): Promise<void> {
  for (let index = 0; index < pageCount; index++) {
    const image = await getPageImage(fromBoardId, index);
    if (image) await savePageImage(toBoardId, index, image);
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * يحمّل صور صفحات الـ PDF كروابط مؤقتة (Object URLs) ويخزّنها مؤقتًا في الذاكرة
 * عشان التنقل بين الصفحات والمصغّرات ما يقراش من IndexedDB كل مرة.
 */
export class PageImageCache {
  private urls = new Map<number, string>();

  constructor(private readonly boardId: string) {}

  async urlFor(pageIndex: number): Promise<string | null> {
    const cached = this.urls.get(pageIndex);
    if (cached) return cached;
    const blob = await getPageImage(this.boardId, pageIndex);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.urls.set(pageIndex, url);
    return url;
  }

  put(pageIndex: number, blob: Blob): string {
    const previous = this.urls.get(pageIndex);
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(blob);
    this.urls.set(pageIndex, url);
    return url;
  }

  clear() {
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls.clear();
  }
}
