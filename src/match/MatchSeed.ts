import { DEFAULT_MATCH_RULES } from './MatchTypes';

export interface RuntimeMatchSeedOptions {
  entropy?: number;
  nowMs?: number;
  sequenceIndex?: number;
}

export function parseMatchSeedOverride(searchParams: URLSearchParams): number | null {
  const value = searchParams.get('matchSeed') ?? searchParams.get('seed');
  if (value === null || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return normalizeMatchSeed(parsed);
}

export function createRuntimeMatchSeed(options: RuntimeMatchSeedOptions = {}): number {
  const entropy = Number.isFinite(options.entropy)
    ? Math.trunc(options.entropy as number)
    : readRuntimeEntropy();
  const nowMs = Number.isFinite(options.nowMs)
    ? Math.trunc(options.nowMs as number)
    : readRuntimeNowMs();
  const sequenceIndex = Number.isFinite(options.sequenceIndex)
    ? Math.trunc(options.sequenceIndex as number)
    : 0;

  return stableSeedHash([
    DEFAULT_MATCH_RULES.seed,
    entropy,
    nowMs,
    sequenceIndex,
  ].join(':'));
}

export function normalizeMatchSeed(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MATCH_RULES.seed;
  }

  return Math.abs(Math.trunc(value)) >>> 0;
}

function readRuntimeEntropy(): number {
  const crypto = globalThis.crypto;
  if (!crypto || typeof crypto.getRandomValues !== 'function') {
    return 0;
  }

  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] ?? 0;
}

function readRuntimeNowMs(): number {
  const now = Date.now();
  if (typeof performance === 'undefined' || typeof performance.now !== 'function') {
    return now;
  }

  return now + performance.now();
}

function stableSeedHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
