import {
  DYNASTY_ACTIVE_SAVE_KEY,
  DYNASTY_DATABASE_NAME,
  DYNASTY_SAVE_STORE_NAME,
  type StoredDynastySaveRecord,
} from './DynastyTypes';
import type { DynastySaveStore } from './DynastySaveRepository';

export class IndexedDbDynastySaveStore implements DynastySaveStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  static createFromGlobal(): IndexedDbDynastySaveStore | null {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    return new IndexedDbDynastySaveStore(indexedDB);
  }

  async get(): Promise<StoredDynastySaveRecord | null> {
    const database = await this.openDatabase();
    return await requestToPromise<StoredDynastySaveRecord | undefined>(
      database
        .transaction(DYNASTY_SAVE_STORE_NAME, 'readonly')
        .objectStore(DYNASTY_SAVE_STORE_NAME)
        .get(DYNASTY_ACTIVE_SAVE_KEY),
    ) ?? null;
  }

  async put(record: StoredDynastySaveRecord): Promise<void> {
    const database = await this.openDatabase();
    await requestToPromise(
      database
        .transaction(DYNASTY_SAVE_STORE_NAME, 'readwrite')
        .objectStore(DYNASTY_SAVE_STORE_NAME)
        .put(record, DYNASTY_ACTIVE_SAVE_KEY),
    );
  }

  async reset(): Promise<void> {
    const database = await this.openDatabase();
    await requestToPromise(
      database
        .transaction(DYNASTY_SAVE_STORE_NAME, 'readwrite')
        .objectStore(DYNASTY_SAVE_STORE_NAME)
        .delete(DYNASTY_ACTIVE_SAVE_KEY),
    );
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = this.factory.open(DYNASTY_DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(DYNASTY_SAVE_STORE_NAME)) {
            database.createObjectStore(DYNASTY_SAVE_STORE_NAME);
          }
        };
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onsuccess = () => resolve(request.result);
      });
    }
    return this.databasePromise;
  }
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    request.onsuccess = () => resolve(request.result);
  });
}
