import type { MatchPossession } from './MatchTypes';

export type CoinFace = 'heads' | 'tails';
export type CoinTossPhase = 'animating' | 'awaitingCall' | 'notStarted' | 'resolved';

export interface CoinTossState {
  completed: boolean;
  firstHalfOpeningPossession: MatchPossession | null;
  phase: CoinTossPhase;
  resolvedFace: CoinFace | null;
  secondHalfOpeningPossession: MatchPossession | null;
  tossIndex: number;
  userCall: CoinFace | null;
  winner: MatchPossession | null;
}

export interface ResolvedCoinToss {
  firstHalfOpeningPossession: MatchPossession;
  resolvedFace: CoinFace;
  secondHalfOpeningPossession: MatchPossession;
  tossIndex: number;
  userCall: CoinFace;
  winner: MatchPossession;
}

export function createCoinTossState(): CoinTossState {
  return {
    completed: false,
    firstHalfOpeningPossession: null,
    phase: 'notStarted',
    resolvedFace: null,
    secondHalfOpeningPossession: null,
    tossIndex: 0,
    userCall: null,
    winner: null,
  };
}

export function enterOpeningCoinToss(state: CoinTossState): CoinTossState {
  if (state.completed) {
    return cloneCoinTossState(state);
  }

  return {
    ...cloneCoinTossState(state),
    phase: 'awaitingCall',
    tossIndex: 0,
  };
}

export function resolveOpeningCoinToss(
  state: CoinTossState,
  seed: number,
  userCall: CoinFace,
): CoinTossState {
  if (state.completed) {
    return cloneCoinTossState(state);
  }

  const result = createResolvedCoinToss(seed, userCall, 0);

  return {
    completed: true,
    firstHalfOpeningPossession: result.firstHalfOpeningPossession,
    phase: 'resolved',
    resolvedFace: result.resolvedFace,
    secondHalfOpeningPossession: result.secondHalfOpeningPossession,
    tossIndex: result.tossIndex,
    userCall: result.userCall,
    winner: result.winner,
  };
}

export function createResolvedCoinToss(
  seed: number,
  userCall: CoinFace,
  tossIndex = 0,
): ResolvedCoinToss {
  const resolvedFace = resolveCoinTossFace(seed, tossIndex);
  const winner = userCall === resolvedFace ? 'user' : 'opponent';
  const secondHalfOpeningPossession = winner === 'user' ? 'opponent' : 'user';

  return {
    firstHalfOpeningPossession: winner,
    resolvedFace,
    secondHalfOpeningPossession,
    tossIndex,
    userCall,
    winner,
  };
}

export function resolveCoinTossFace(seed: number, tossIndex = 0): CoinFace {
  return stableHash(`${seed}:openingCoinToss:${tossIndex}`) % 2 === 0 ? 'heads' : 'tails';
}

export function cloneCoinTossState(state: CoinTossState): CoinTossState {
  return {
    completed: state.completed,
    firstHalfOpeningPossession: state.firstHalfOpeningPossession,
    phase: state.phase,
    resolvedFace: state.resolvedFace,
    secondHalfOpeningPossession: state.secondHalfOpeningPossession,
    tossIndex: state.tossIndex,
    userCall: state.userCall,
    winner: state.winner,
  };
}

export function isCoinFace(value: string | null): value is CoinFace {
  return value === 'heads' || value === 'tails';
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
