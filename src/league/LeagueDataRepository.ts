import {
  decodeLeagueData,
  encodeLeagueData,
  estimateDecodedLeagueBytes,
  estimateEncodedLeagueBytes,
} from './LeagueDataCodec';
import { generateLeagueData } from './LeagueGenerator';
import {
  BUNDLED_LEAGUE_DATA_URL,
  DEFAULT_LEAGUE_SEED,
  LEAGUE_GENERATOR_VERSION,
  LEAGUE_RECORD_KEY,
  LEAGUE_SCHEMA_VERSION,
  type EncodedLeagueData,
  type LeagueData,
  type LeagueDataSource,
  type StoredLeagueRecord,
} from './LeagueTypes';
import {
  throwOnLeagueValidationErrors,
  validateEncodedLeagueData,
  validateLeagueData,
} from './LeagueValidation';

export interface LeagueDataStore {
  get(): Promise<StoredLeagueRecord | null>;
  put(record: StoredLeagueRecord): Promise<void>;
  reset(): Promise<void>;
}

export interface LeagueRepositoryStage {
  readonly stage: string;
}

export interface LeagueRepositoryResult {
  readonly data: LeagueData;
  readonly decodedEstimateBytes: number;
  readonly encoded: EncodedLeagueData;
  readonly encodedBytes: number;
  readonly generatedAt: string | null;
  readonly initializationDurationMs: number;
  readonly source: LeagueDataSource;
  readonly warning: string | null;
}

export interface LeagueRepositoryOptions {
  readonly bundledUrl?: string;
  readonly fetchJson?: (url: string) => Promise<EncodedLeagueData>;
  readonly now?: () => Date;
  readonly onStage?: (stage: LeagueRepositoryStage) => void;
  readonly store?: LeagueDataStore | null;
}

export async function initializeLeagueData(
  options: LeagueRepositoryOptions = {},
): Promise<LeagueRepositoryResult> {
  const startedAt = performanceNow();
  const now = options.now ?? (() => new Date());
  const onStage = options.onStage ?? (() => {});
  const bundledUrl = options.bundledUrl ?? BUNDLED_LEAGUE_DATA_URL;
  const fetchJson = options.fetchJson ?? fetchBundledLeagueData;
  const store = options.store ?? null;
  onStage({ stage: 'Reading bundled league' });

  let encoded: EncodedLeagueData;
  let warning: string | null = null;
  try {
    encoded = await fetchJson(bundledUrl);
    throwOnLeagueValidationErrors(validateEncodedLeagueData(encoded));
  } catch (error) {
    warning = `Bundled league unavailable; generated in memory: ${getErrorMessage(error)}`;
    const generated = generateLeagueData({ seed: DEFAULT_LEAGUE_SEED });
    encoded = encodeLeagueData(generated);
  }

  const expectedKey = {
    contentHash: encoded.contentHash,
    generatorVersion: encoded.generatorVersion,
    schemaVersion: encoded.schemaVersion,
  };
  let source: LeagueDataSource = store ? 'bundled' : 'memoryFallback';
  let generatedAt: string | null = null;

  if (store) {
    onStage({ stage: 'Checking IndexedDB league cache' });
    try {
      const cached = await store.get();
      if (
        cached &&
        cached.schemaVersion === expectedKey.schemaVersion &&
        cached.generatorVersion === expectedKey.generatorVersion &&
        cached.contentHash === expectedKey.contentHash
      ) {
        throwOnLeagueValidationErrors(validateEncodedLeagueData(cached.payload));
        encoded = cached.payload;
        generatedAt = cached.generatedAt;
        source = 'indexedDB';
      }
    } catch (error) {
      warning = `League cache ignored: ${getErrorMessage(error)}`;
    }
  }

  onStage({ stage: 'Decoding league' });
  const decoded = decodeLeagueData(encoded);
  throwOnLeagueValidationErrors(validateLeagueData(decoded));

  if (store && source !== 'indexedDB') {
    const record: StoredLeagueRecord = {
      contentHash: encoded.contentHash,
      generatedAt: now().toISOString(),
      generatorVersion: encoded.generatorVersion,
      key: LEAGUE_RECORD_KEY,
      payload: encoded,
      schemaVersion: encoded.schemaVersion,
    };
    generatedAt = record.generatedAt;
    void store.put(record).catch(() => {
      // IndexedDB is an optimization. A failed write must not block the menu.
    });
  }

  onStage({ stage: 'League ready' });
  return {
    data: decoded,
    decodedEstimateBytes: estimateDecodedLeagueBytes(decoded),
    encoded,
    encodedBytes: estimateEncodedLeagueBytes(encoded),
    generatedAt,
    initializationDurationMs: performanceNow() - startedAt,
    source,
    warning,
  };
}

export async function fetchBundledLeagueData(url: string): Promise<EncodedLeagueData> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json() as EncodedLeagueData;
}

export function createMemoryLeagueStore(initial: StoredLeagueRecord | null = null): LeagueDataStore {
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

export function isCurrentLeagueRecord(record: StoredLeagueRecord | null): boolean {
  return !!record &&
    record.schemaVersion === LEAGUE_SCHEMA_VERSION &&
    record.generatorVersion === LEAGUE_GENERATOR_VERSION;
}

function performanceNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
