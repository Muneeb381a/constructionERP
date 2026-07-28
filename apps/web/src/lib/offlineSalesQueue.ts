import type { CreateSaleInvoiceInput } from "./api/invoices";

const DB_NAME = "construction-erp-offline";
const STORE = "pending-sales";
const DB_VERSION = 1;

export type QueuedSale = {
  idempotencyKey: string;
  input: CreateSaleInvoiceInput;
  queuedAt: string;
  partyName: string | null;
  total: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "idempotencyKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function queueSale(entry: QueuedSale): Promise<void> {
  await withStore("readwrite", (store) => store.put(entry));
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  if (!("indexedDB" in window)) return [];
  return withStore("readonly", (store) => store.getAll());
}

export async function removeQueuedSale(idempotencyKey: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(idempotencyKey));
}

/** True network failure (no server response at all) vs. a server-returned error —
 * only the former means "we're actually offline, queue it and retry later." */
export function isNetworkError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "isAxiosError" in err && !(err as { response?: unknown }).response;
}
