import type * as THREE from 'three';
import type { CoinFace } from '../../match/CoinTossModel';
import type { MatchPossession, MatchSnapshot } from '../../match/MatchTypes';
import type { GameplaySnapshot } from '../../playState';
import type { PlayerRole, PlayerTeam } from '../../playerModel';
import type { FootballPosition } from '../../elevenOnElevenFormation';

export type CoinTossPresentationPhase =
  | 'animating'
  | 'awaitingCall'
  | 'completed'
  | 'idle'
  | 'result';

export interface CoinTossCaptainSubject {
  appearanceId: string;
  displayName: string;
  footballPosition: string;
  gameplayPlayerId: string | null;
  jerseyNumber: number | null;
  rosterPlayerId: string;
  team: MatchPossession;
}

export interface CoinTossCaptainPlacement {
  appearanceId: string;
  facingRadians: number;
  footballPosition: FootballPosition | 'UNKNOWN';
  gameplayPlayerId: string | null;
  gameplayTeam: PlayerTeam;
  id: string;
  jerseyNumber: number | null;
  position: { x: number; y: number; z: number };
  role: PlayerRole;
  rosterPlayerId: string;
  scale: number;
  team: MatchPossession;
  visualId: string;
}

export interface CoinTossPresentationLayout {
  captains: readonly CoinTossCaptainSubject[];
  captainPlacements: readonly CoinTossCaptainPlacement[];
  coinPosition: { x: number; y: number; z: number };
  noGameplayAuthority: true;
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
  captainRosterIds: readonly string[];
  captainVisualCount: number;
  captainsVisible: number;
  completionBlockers: readonly string[];
  coinVisible: boolean;
  gameplayPlayersVisible: boolean;
  bareHeadCount: number;
  helmetReadyCount: number;
  matchSeed: number | null;
  nextStage: 'kickoff' | null;
  openingPossession: MatchPossession | null;
  phase: CoinTossPresentationPhase;
  refereeVisible: boolean;
  officialsVisibleCount: number;
  resolvedFace: CoinFace | null;
  secondHalfPossession: MatchPossession | null;
  selectedCall: CoinFace;
  stageId: 'coinToss' | 'none';
  userCall: CoinFace | null;
  visualProfileCount: number;
  visualProfileId: string;
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
