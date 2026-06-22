import type { PregameCommentarySelection, PregameWeatherCondition } from '../../audio/PregameCommentaryCatalog';
import type { CinematicsSetting, GameplayCameraMode } from '../../camera/CameraTypes';
import type { GameplaySnapshot } from '../../playState';
import type { MatchSnapshot } from '../../match/MatchTypes';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import type { SidelineTeamControllerSnapshot, SidelineTeamSide, SidelineZone } from '../teams/SidelineTeamTypes';
import type { StadiumControllerSnapshot } from '../../stadium/StadiumController';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import type { PlayerSpotlightStageSnapshot } from './PlayerSpotlightStage';

export type PregamePresentationPhase = 'completed' | 'idle' | 'running' | 'skipped';

export type PregameShotId =
  | 'matchupCombined'
  | 'opponentTeamPan'
  | 'quarterbackSpotlight'
  | 'stadiumEstablish'
  | 'transitionToGameplay'
  | 'userTeamTunnelOrSideline'
  | 'weatherAndField';

export type PregameCommentaryLineId = 'matchup' | 'quarterback' | 'weather' | 'welcome';

export interface PregameSequenceStep {
  commentaryLineId?: PregameCommentaryLineId;
  lowerThirdTeamSide?: SidelineTeamSide;
  minimumSeconds: number;
  shotId: PregameShotId;
  waitForCommentaryLineId?: PregameCommentaryLineId;
}

export interface PregamePresentationContext {
  aspectRatio: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
  rosterBinding: GameplayRosterBinding;
  sidelineSnapshot: SidelineTeamControllerSnapshot;
  stadiumSnapshot: StadiumControllerSnapshot;
  targetGameplayCamera: GameplayCameraMode;
  teamTheme: TeamPresentationTheme;
  weatherCondition: PregameWeatherCondition;
}

export interface PregameCommentarySelections {
  matchup: PregameCommentarySelection;
  quarterback: PregameCommentarySelection;
  weather: PregameCommentarySelection;
  welcome: PregameCommentarySelection;
}

export interface PregameSubjectBounds {
  center: { x: number; y: number; z: number };
  max: { x: number; z: number };
  min: { x: number; z: number };
  size: { x: number; z: number };
  source: PregameShotId | SidelineZone['id'] | 'field';
}

export interface PregameLowerThirdState {
  abbreviation: string | null;
  accentColor: string;
  caption: string | null;
  displayName: string | null;
  detail: string | null;
  visible: boolean;
}

export interface PregamePresentationSnapshot {
  activeCommentary: string | null;
  completed: boolean;
  currentShot: PregameShotId | null;
  elapsedSeconds: number;
  holdReason: string | null;
  lowerThird: PregameLowerThirdState;
  musicGain: number;
  phase: PregamePresentationPhase;
  progress: number;
  sequence: PregameShotId[];
  shotElapsedSeconds: number;
  skipState: 'available' | 'completed' | 'idle' | 'skipped';
  spotlight: PlayerSpotlightStageSnapshot;
  subjectBounds: PregameSubjectBounds | null;
  targetGameplayCamera: GameplayCameraMode;
  weatherCondition: PregameWeatherCondition;
}

export interface PregameAudioLineSnapshot {
  assetId: string | null;
  caption: string | null;
  completed: boolean;
  failed: boolean;
  lineId: PregameCommentaryLineId;
  remainingSeconds: number;
  started: boolean;
}

export interface PregameAudioCoordinatorSnapshot {
  activeLine: PregameAudioLineSnapshot | null;
  completedLineIds: PregameCommentaryLineId[];
  crowdGain: number;
  failedLineIds: PregameCommentaryLineId[];
  history: {
    assetId: string | null;
    lineId: PregameCommentaryLineId;
    reason: string | null;
    status: 'completed' | 'played' | 'skipped' | 'started' | 'suppressed';
  }[];
  musicGain: number;
}
