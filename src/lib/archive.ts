import type { Appraisal, ArchiveRecord } from './types';

// The archive lives on the user's device (IndexedDB): photos and appraisals never leave it
// except for the single analysis request.

const DB_NAME = 'vintagem';
const STORE = 'appraisals';
let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();
// In-memory copy of records seen this session, so a screen can render instantly (and morph its photo).
const memory = new Map<string, ArchiveRecord>();

export function peekAppraisal(id: string) {
  return memory.get(id);
}

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('createdAt', 'createdAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function saveAppraisal(appraisal: Appraisal, photo: Blob, thumb: Blob) {
  const record: ArchiveRecord = { id: appraisal.id, createdAt: appraisal.createdAt, appraisal, photo, thumb };
  await tx('readwrite', (s) => s.put(record));
  memory.set(record.id, record);
  notify();
  return record;
}

export async function getAppraisal(id: string) {
  const record = await tx<ArchiveRecord | undefined>('readonly', (s) => s.get(id));
  if (record) memory.set(id, record);
  return record;
}

export async function listAppraisals(): Promise<ArchiveRecord[]> {
  const all = await tx<ArchiveRecord[]>('readonly', (s) => s.getAll());
  all.forEach((r) => memory.set(r.id, r));
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAppraisal(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  memory.delete(id);
  notify();
}

export async function clearArchive() {
  await tx('readwrite', (s) => s.clear());
  memory.clear();
  notify();
}
