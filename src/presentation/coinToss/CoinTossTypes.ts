import type * as THREE from 'three';
import type { CoinFace } from '../../match/CoinTossModel';
import type { MatchPossession, MatchSnapshot } from '../../match/MatchTypes';
import type { GameplaySnapshot } from '../../playState';
import type { SidelinePlayerPlacement } from '../teams/SidelineTeamTypes';
import type { OfficialModel } from '../../officials/OfficialTypes';

export type CoinTossPresentationPhase =
  | 'animating'
  | 'awaitingCall'
  | 'completed'
  | 'idle'
  | 'result';

export interface CoinTossCaptainSubject {
  displayName: string;
  footballPosition: string;
  gameplayPlayerId: string | null;
  rosterPlayerId: string;
  team: MatchPossession;
}

export interface CoinTossPresentationLayout {
  captains: readonly CoinTossCaptainSubject[];
  captainPlacements: readonly SidelinePlayerPlacement[];
  coinPosition: { x: number; y: number; z: number };
  noGameplayAuthority: true;
  officials: readonly OfficialModel[];
}

export interface CoinTossAnimationSnapshot {
  finalRotationX: number | null;
  progress: number;
  y: number;
}

export interface CoinTossCameraShot {
  fieldOfView: number;
  focus: THREE.Vector3;
  lookTarget: THREE.Vector3;
  position: THREE.Vector3;
  progress: number;
}

export interface CoinTossDebugSnapshot {
  activeCommentary: string | null;
  animation: CoinTossAnimationSnapshot;
  callLocked: boolean;
  captainsVisible: number;
  completionBlockers: readonly string[];
  matchSeed: number | null;
  openingPossession: MatchPossession | null;
  phase: CoinTossPresentationPhase;
  refereeVisible: boolean;
  resolvedFace: CoinFace | null;
  secondHalfPossession: MatchPossession | null;
  selectedCall: CoinFace;
  userCall: CoinFace | null;
  winner: MatchPossession | null;
}

export interface CoinTossFrameResult {
  completed: boolean;
  requestedCall: CoinFace | null;
}

export interface CoinTossControllerContext {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
}
