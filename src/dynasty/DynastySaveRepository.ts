import type { TeamProfile } from '../teams/TeamProfile';
import { createDynastySeasonCore } from './DynastySchedule';
import {
  DYNASTY_ACTIVE_SAVE_KEY,
  DYNASTY_SAVE_SCHEMA_VERSION,
  DYNASTY_SEASON_CORE_VERSION,
  type DynastySaveData,
  type DynastySaveSource,
  type StoredDynastySaveRecord,
} from './DynastyTypes';
import {
  throwOnDynastyValidationErrors,
  validateDynastySaveData,
} from './DynastyValidation';

export interface DynastySaveStore {
  get(): Promise<StoredDynastySaveRecord | null>;
  put(record: StoredDynastySaveRecord): Promise<void>;
  reset(): Promise<void>;
}

export interface DynastyLoadResult {
  readonly save: DynastySaveData | null;
  readonly source: DynastySaveSource;
  readonly warning: string | null;
}

export interface DynastyPersistResult {
  readonly save: DynastySaveData;
  readonly source: DynastySaveSource;
  readonly warning: string | null;
}

export interface DynastyCreateOptions {
  readonly createdAt?: string;
  readonly now?: () => Date;
  readonly seasonYear?: number;
  readonly seed: string;
  readonly store?: DynastySaveStore | null;
  readonly teams: readonly Pick<TeamProfile, 'id'>[];
  readonly userTeamId: string;
}

export interface DynastyLoadOptions {
  readonly store?: DynastySaveStore | null;
}

export interface DynastyPersistOptions {
  readonly now?: () => Date;
  readonly store?: DynastySaveStore | null;
}

export async function createAndPersistDynastySave(
  options: DynastyCreateOptions,
): Promise<DynastyPersistResult> {
  const now = options.now ?? (() => new Date());
  const createdAt = options.createdAt ?? now().toISOString();
  const save = createDynastySeasonCore({
    createdAt,
    seasonYear: options.seasonYear,
    seed: options.seed,
    teams: options.teams,
    userTeamId: options.userTeamId,
  });
  return await persistDynastySave(save, {
    now,
    store: options.store ?? null,
  }, 'created');
}

export async function loadDynastySave(
  options: DynastyLoadOptions = {},
): Promise<DynastyLoadResult> {
  const store = options.store ?? null;
  if (!store) {
    return {
      save: null,
      source: 'memoryFallback',
      warning: 'Dynasty save storage is unavailable.',
    };
  }

  try {
    const record = await store.get();
    if (!record) {
      return {
        save: null,
        source: 'none',
        warning: null,
      };
    }
    const migrated = migrateDynastySaveRecord(record);
    throwOnDynastyValidationErrors(validateDynastySaveData(migrated.payload));
    if (migrated !== record) {
      await store.put(migrated);
    }
    return {
      save: migrated.payload,
      source: 'indexedDB',
      warning: null,
    };
  } catch (error) {
    return {
      save: null,
      source: 'none',
      warning: `Dynasty save ignored: ${getErrorMessage(error)}`,
    };
  }
}

export async function persistDynastySave(
  save: DynastySaveData,
  options: DynastyPersistOptions = {},
  source: DynastySaveSource = 'indexedDB',
): Promise<DynastyPersistResult> {
  const store = options.store ?? null;
  const now = options.now ?? (() => new Date());
  const updatedSave: DynastySaveData = {
    ...save,
    updatedAt: now().toISOString(),
  };
  throwOnDynastyValidationErrors(validateDynastySaveData(updatedSave));

  if (!store) {
    return {
      save: updatedSave,
      source: 'memoryFallback',
      warning: 'Dynasty save storage is unavailable.',
    };
  }

  const record: StoredDynastySaveRecord = {
    key: DYNASTY_ACTIVE_SAVE_KEY,
    modeVersion: DYNASTY_SEASON_CORE_VERSION,
    payload: updatedSave,
    savedAt: updatedSave.updatedAt,
    schemaVersion: DYNASTY_SAVE_SCHEMA_VERSION,
  };
  await store.put(record);

  return {
    save: updatedSave,
    source,
    warning: null,
  };
}

export async function resetDynastySave(
  options: DynastyLoadOptions = {},
): Promise<void> {
  await options.store?.reset();
}

export function createMemoryDynastySaveStore(
  initial: StoredDynastySaveRecord | null = null,
): DynastySaveStore {
  let record = initial;
  return {
    get: async () => record,
    put: async (nextRecord) => {
      record = nextRecord;
    },
    reset: async () => {
      record = null;
    },
  };
}

export function migrateDynastySaveRecord(
  record: StoredDynastySaveRecord,
): StoredDynastySaveRecord {
  if (
    record.key === DYNASTY_ACTIVE_SAVE_KEY &&
    record.schemaVersion === DYNASTY_SAVE_SCHEMA_VERSION &&
    record.modeVersion === DYNASTY_SEASON_CORE_VERSION &&
    record.payload.schemaVersion === DYNASTY_SAVE_SCHEMA_VERSION &&
    record.payload.modeVersion === DYNASTY_SEASON_CORE_VERSION
  ) {
    return record;
  }

  throw new Error(
    `Unsupported dynasty save version ${record.schemaVersion}/${record.modeVersion}`,
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
