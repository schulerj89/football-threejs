import type { AudioPlaybackCategory } from '../../audio/AudioAssetManifest';
import type { AudioPlaybackCompletion } from '../../audio/AudioMixer';
import type { BroadcastScriptId, HalftimeCategory } from '../../audio/voicePacks/VoicePackTypes';
import type { GameplayCameraMode } from '../../camera/CameraTypes';
import type { MatchPossession, MatchSnapshot } from '../../match/MatchTypes';

export type HalftimePresentationPhase = 'completed' | 'idle' | 'running' | 'skipped';

export type HalftimeLineId = 'opening' | 'story' | 'transition';

export interface HalftimeStory {
  readonly category: HalftimeCategory;
  readonly contextSummary: string | null;
  readonly scriptId: BroadcastScriptId;
  readonly supportingStatKeys: readonly string[];
  readonly supportingTeam: MatchPossession | null;
}

export interface HalftimeTeamStatsView {
  readonly firstDowns: number;
  readonly logoUrl: string;
  readonly name: string;
  readonly possessionSeconds: number;
  readonly primaryColor: string;
  readonly passingYards: number;
  readonly rushingYards: number;
  readonly score: number;
  readonly shortName: string;
  readonly team: MatchPossession;
  readonly thirdDownText: string;
  readonly totalYards: number;
  readonly turnovers: number;
}

export interface HalftimeLeaderView {
  readonly label: string;
  readonly statText: string;
  readonly team: MatchPossession;
  readonly value: string;
}

export interface HalftimeStatsViewModel {
  readonly leaders: readonly HalftimeLeaderView[];
  readonly rows: readonly {
    readonly key: string;
    readonly label: string;
    readonly opponent: string;
    readonly user: string;
  }[];
  readonly teams: readonly [HalftimeTeamStatsView, HalftimeTeamStatsView];
}

export interface HalftimeAudioLineSnapshot {
  readonly actualEndedAtSeconds: number | null;
  readonly assetId: string | null;
  readonly catalogDurationSeconds: number | null;
  readonly caption: string | null;
  readonly completed: boolean;
  readonly failed: boolean;
  readonly lineId: HalftimeLineId;
  readonly playbackState: 'failed' | 'playing' | 'queued' | 'quietGap' | 'starting' | 'suppressed';
  readonly remainingSeconds: number;
  readonly safetyEndsAtSeconds: number | null;
  readonly scriptId: BroadcastScriptId | null;
  readonly startedAtSeconds: number | null;
}

export interface HalftimeAudioHistoryEntry {
  readonly actualEndedAtSeconds?: number | null;
  readonly actualStartedAtSeconds?: number | null;
  readonly assetId: string | null;
  readonly catalogDurationSeconds?: number | null;
  readonly lineId: HalftimeLineId;
  readonly reason: AudioPlaybackCompletion['reason'] | 'missingAsset' | 'muted' | 'audioDisabled' | 'announcerDisabled' | 'safetyTimeout' | 'skip' | 'suspended' | null;
  readonly scriptId: BroadcastScriptId | null;
  readonly status: 'completed' | 'ended' | 'played' | 'queued' | 'skipped' | 'started' | 'suppressed';
  readonly timeSeconds: number;
}

export interface HalftimePresentationSnapshot {
  readonly activeLine: HalftimeAudioLineSnapshot | null;
  readonly activeVoicePack: string | null;
  readonly canContinue: boolean;
  readonly completed: boolean;
  readonly currentLine: HalftimeLineId | null;
  readonly elapsedSeconds: number;
  readonly gameplayPlayerVisibleCount: number;
  readonly history: readonly HalftimeAudioHistoryEntry[];
  readonly nextPossession: MatchPossession;
  readonly phase: HalftimePresentationPhase;
  readonly queuedLine: HalftimeAudioLineSnapshot | null;
  readonly selectedStory: HalftimeStory | null;
  readonly shotProgress: number;
  readonly sidelineVisibleCount: number;
  readonly stats: HalftimeStatsViewModel | null;
  readonly targetGameplayCamera: GameplayCameraMode;
}

export interface HalftimePresentationUpdateResult {
  readonly completed: boolean;
  readonly continueRequested: boolean;
}

export interface HalftimePresentationStartOptions {
  readonly matchSnapshot: MatchSnapshot;
}
