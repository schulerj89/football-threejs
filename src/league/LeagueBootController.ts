import { IndexedDbLeagueStore } from './IndexedDbLeagueStore';
import {
  DEFAULT_LEAGUE_SEED,
  LEAGUE_GENERATOR_VERSION,
  LEAGUE_SCHEMA_VERSION,
  type LeagueData,
  type LeagueInitializationSnapshot,
} from './LeagueTypes';
import {
  initializeLeagueData,
  type LeagueDataStore,
  type LeagueRepositoryOptions,
  type LeagueRepositoryResult,
} from './LeagueDataRepository';

export interface LeagueBootControllerOptions {
  readonly loadingThresholdMs?: number;
  readonly repositoryOptions?: Omit<LeagueRepositoryOptions, 'onStage' | 'store'>;
  readonly store?: LeagueDataStore | null;
}

type Listener = () => void;

export class LeagueBootController {
  private readonly loadingThresholdMs: number;
  private readonly listeners = new Set<Listener>();
  private readonly repositoryOptions: Omit<LeagueRepositoryOptions, 'onStage' | 'store'>;
  private readonly store: LeagueDataStore | null;
  private dataValue: LeagueData | null = null;
  private errorValue: string | null = null;
  private initializedPromise: Promise<LeagueRepositoryResult> | null = null;
  private lastResult: LeagueRepositoryResult | null = null;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingVisible = false;
  private stage = 'Idle';
  private status: LeagueInitializationSnapshot['status'] = 'idle';
  private startedAt = 0;

  constructor(options: LeagueBootControllerOptions = {}) {
    this.loadingThresholdMs = options.loadingThresholdMs ?? 150;
    this.repositoryOptions = options.repositoryOptions ?? {};
    this.store = options.store ?? IndexedDbLeagueStore.createFromGlobal();
  }

  get data(): LeagueData | null {
    return this.dataValue;
  }

  start(): Promise<LeagueRepositoryResult> {
    if (this.initializedPromise) {
      return this.initializedPromise;
    }

    this.status = 'initializing';
    this.stage = 'Preparing League';
    this.startedAt = nowMs();
    this.loadingTimer = setTimeout(() => {
      if (this.status === 'initializing') {
        this.loadingVisible = true;
        this.emit();
      }
    }, this.loadingThresholdMs);
    this.emit();

    this.initializedPromise = initializeLeagueData({
      ...this.repositoryOptions,
      onStage: ({ stage }) => {
        this.stage = stage;
        this.emit();
      },
      store: this.store,
    })
      .then((result) => {
        this.lastResult = result;
        this.dataValue = result.data;
        this.status = 'ready';
        this.errorValue = result.warning;
        this.stage = 'League ready';
        this.clearLoadingTimer();
        this.loadingVisible = false;
        this.emit();
        return result;
      })
      .catch((error) => {
        this.status = 'error';
        this.errorValue = error instanceof Error ? error.message : String(error);
        this.stage = 'League unavailable';
        this.clearLoadingTimer();
        this.loadingVisible = false;
        this.emit();
        throw error;
      });

    return this.initializedPromise;
  }

  async resetLeagueData(): Promise<void> {
    await this.store?.reset();
    this.initializedPromise = null;
    this.lastResult = null;
    this.dataValue = null;
    this.errorValue = null;
    this.status = 'idle';
    this.stage = 'Idle';
    this.loadingVisible = false;
    this.clearLoadingTimer();
    this.emit();
  }

  getSnapshot(): LeagueInitializationSnapshot {
    const result = this.lastResult;
    const data = this.dataValue;
    return {
      contentHash: result?.encoded.contentHash ?? data?.contentHash ?? null,
      decodedEstimateBytes: result?.decodedEstimateBytes ?? 0,
      encodedBytes: result?.encodedBytes ?? 0,
      error: this.errorValue,
      generatorVersion: data?.generatorVersion ?? LEAGUE_GENERATOR_VERSION,
      initializationDurationMs: result?.initializationDurationMs ??
        (this.status === 'initializing' ? nowMs() - this.startedAt : 0),
      loadingVisible: this.loadingVisible,
      playerCount: data?.rosters.reduce((sum, roster) => sum + roster.players.length, 0) ?? 0,
      schemaVersion: data?.schemaVersion ?? LEAGUE_SCHEMA_VERSION,
      seed: data?.seed ?? DEFAULT_LEAGUE_SEED,
      source: result?.source ?? (this.status === 'initializing' ? 'initializing' : 'memoryFallback'),
      stage: this.stage,
      status: this.status,
      teamCount: data?.teams.length ?? 0,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.clearLoadingTimer();
    this.listeners.clear();
  }

  private clearLoadingTimer(): void {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
