import {
  LEAGUE_DATABASE_NAME,
  LEAGUE_RECORD_KEY,
  LEAGUE_STORE_NAME,
  type StoredLeagueRecord,
} from './LeagueTypes';
import type { LeagueDataStore } from './LeagueDataRepository';

export class IndexedDbLeagueStore implements LeagueDataStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  static createFromGlobal(): IndexedDbLeagueStore | null {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    return new IndexedDbLeagueStore(indexedDB);
  }

  async get(): Promise<StoredLeagueRecord | null> {
    const database = await this.openDatabase();
    return await requestToPromise<StoredLeagueRecord | undefined>(
      database
        .transaction(LEAGUE_STORE_NAME, 'readonly')
        .objectStore(LEAGUE_STORE_NAME)
        .get(LEAGUE_RECORD_KEY),
    ) ?? null;
  }

  async put(record: StoredLeagueRecord): Promise<void> {
    const database = await this.openDatabase();
    await requestToPromise(
      database
        .transaction(LEAGUE_STORE_NAME, 'readwrite')
        .objectStore(LEAGUE_STORE_NAME)
        .put(record, LEAGUE_RECORD_KEY),
    );
  }

  async reset(): Promise<void> {
    const database = await this.openDatabase();
    await requestToPromise(
      database
        .transaction(LEAGUE_STORE_NAME, 'readwrite')
        .objectStore(LEAGUE_STORE_NAME)
        .delete(LEAGUE_RECORD_KEY),
    );
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = this.factory.open(LEAGUE_DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(LEAGUE_STORE_NAME)) {
            database.createObjectStore(LEAGUE_STORE_NAME);
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
