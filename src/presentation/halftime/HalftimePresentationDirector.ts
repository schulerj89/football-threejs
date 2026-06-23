import type { AudioMixerSnapshot, AudioPlaybackCompletion, AudioPlaybackHandle } from '../../audio/AudioMixer';
import type { AudioSettings } from '../../audio/AudioSettings';
import type { GameMusicDirector } from '../../audio/GameMusicDirector';
import { HALFTIME_SCRIPT_IDS } from '../../audio/voicePacks/VoicePackRegistry';
import type { VoicePackAssetResolver } from '../../audio/voicePacks/VoicePackAssetResolver';
import type { BroadcastScriptId } from '../../audio/voicePacks/VoicePackTypes';
import type { CinematicsSetting, GameplayCameraMode } from '../../camera/CameraTypes';
import type { MatchSnapshot } from '../../match/MatchTypes';
import {
  createHalftimeCameraShot,
  getHalftimeShotDuration,
} from './HalftimeCameraShot';
import type {
  HalftimeAudioHistoryEntry,
  HalftimeAudioLineSnapshot,
  HalftimeLineId,
  HalftimePresentationSnapshot,
  HalftimePresentationUpdateResult,
  HalftimeStatsViewModel,
  HalftimeStory,
} from './HalftimePresentationTypes';
import { HalftimeStatsOverlay } from './HalftimeStatsOverlay';
import { resolveHalftimeStory } from './HalftimeStoryResolver';

export interface HalftimeAudioPort {
  getCurrentTime(): number;
  getSnapshot(): AudioMixerSnapshot;
  playOneShotTracked(assetId: string): Promise<AudioPlaybackHandle | null>;
  setCrowdDuckingGain(gain: number): void;
  setSettings(patch: Partial<AudioSettings>): AudioSettings;
  stopOneShotsByCategory(category: 'announcer'): number;
}

export interface HalftimePresentationDirectorOptions {
  audio: HalftimeAudioPort;
  cinematics: CinematicsSetting;
  gameMusicDirector: Pick<GameMusicDirector, 'requestStinger'>;
  onContinue: () => void;
  overlay?: HalftimeStatsOverlayPort;
  targetGameplayCamera: GameplayCameraMode;
  voicePackResolver: VoicePackAssetResolver;
}

export interface HalftimeStatsOverlayPort {
  dispose(): void;
  hide(): void;
  sync(options: {
    canContinue: boolean;
    matchSnapshot: MatchSnapshot | null;
    story: HalftimeStory | null;
    visible: boolean;
  }): HalftimeStatsViewModel | null;
}

interface HalftimeLineDefinition {
  lineId: HalftimeLineId;
  scriptId: BroadcastScriptId;
}

interface ActiveHalftimeLine {
  actualEndedAtSeconds: number | null;
  assetId: string | null;
  caption: string | null;
  catalogDurationSeconds: number | null;
  completed: boolean;
  endsAtSeconds: number;
  failed: boolean;
  handle: AudioPlaybackHandle | null;
  lineId: HalftimeLineId;
  playbackState: HalftimeAudioLineSnapshot['playbackState'];
  remainingSeconds: number;
  safetyEndsAtSeconds: number | null;
  scriptId: BroadcastScriptId | null;
  startedAtSeconds: number | null;
}

const HALFTIME_AUDIO_CONFIG = {
  crowdDuckGain: 0.72,
  quietGapSeconds: 0.36,
  safetyTimeoutPaddingSeconds: 3,
} as const;

export class HalftimePresentationDirector {
  readonly overlay: HalftimeStatsOverlayPort;

  private activeLine: ActiveHalftimeLine | null = null;
  private canContinue = false;
  private completedLineIds = new Set<HalftimeLineId>();
  private elapsedSeconds = 0;
  private readonly history: HalftimeAudioHistoryEntry[] = [];
  private lineIndex = 0;
  private lines: readonly HalftimeLineDefinition[] = [];
  private matchKey: string | null = null;
  private phase: HalftimePresentationSnapshot['phase'] = 'idle';
  private queuedLine: HalftimeLineDefinition | null = null;
  private statsViewModel: HalftimeStatsViewModel | null = null;
  private story: HalftimeStory | null = null;
  private stingerRequested = false;

  constructor(private readonly options: HalftimePresentationDirectorOptions) {
    this.overlay = options.overlay ?? new HalftimeStatsOverlay({
      onContinue: options.onContinue,
    });
  }

  start(matchSnapshot: MatchSnapshot): boolean {
    const key = createMatchHalftimeKey(matchSnapshot);
    if (this.matchKey === key && this.phase === 'running') {
      return false;
    }

    this.reset();
    this.matchKey = key;
    this.phase = 'running';
    this.story = resolveHalftimeStory(matchSnapshot);
    this.lines = [
      {
        lineId: 'opening',
        scriptId: selectHalftimeUtilityScript('halftimeOpening', matchSnapshot.deterministicSeed),
      },
      {
        lineId: 'story',
        scriptId: this.story.scriptId,
      },
      {
        lineId: 'transition',
        scriptId: selectHalftimeUtilityScript('secondHalfTransition', matchSnapshot.deterministicSeed + 7),
      },
    ];
    this.stingerRequested = false;
    return true;
  }

  update(options: {
    deltaSeconds: number;
    gameplayPlayerVisibleCount: number;
    matchSnapshot: MatchSnapshot | null;
    sidelineVisibleCount: number;
  }): HalftimePresentationUpdateResult {
    if (this.phase !== 'running' || !options.matchSnapshot) {
      this.overlay.sync({
        canContinue: false,
        matchSnapshot: null,
        story: null,
        visible: false,
      });
      return {
        completed: this.phase === 'completed',
        continueRequested: false,
      };
    }

    this.elapsedSeconds += Math.max(0, options.deltaSeconds);
    if (!this.stingerRequested) {
      this.stingerRequested = true;
      void this.options.gameMusicDirector.requestStinger('halftime');
    }
    this.updateSpeechState();
    this.startNextLineIfReady();
    this.canContinue = this.elapsedSeconds >= 1.2;
    this.statsViewModel = this.overlay.sync({
      canContinue: this.canContinue,
      matchSnapshot: options.matchSnapshot,
      story: this.story,
      visible: true,
    });

    return {
      completed: false,
      continueRequested: false,
    };
  }

  createCameraShot() {
    return createHalftimeCameraShot({
      cinematics: this.options.cinematics,
      elapsedSeconds: this.elapsedSeconds,
      restoreCamera: this.options.targetGameplayCamera,
    });
  }

  finish(): void {
    if (this.activeLine) {
      this.recordHistory(this.activeLine.lineId, this.activeLine.assetId, 'skipped', 'skip', {
        actualStartedAtSeconds: this.activeLine.startedAtSeconds,
        catalogDurationSeconds: this.activeLine.catalogDurationSeconds,
      });
      this.activeLine.handle?.stop(0.08);
    }
    this.options.audio.stopOneShotsByCategory('announcer');
    this.restoreAudio();
    this.activeLine = null;
    this.queuedLine = null;
    this.phase = 'completed';
    this.overlay.hide();
  }

  reset(): void {
    this.activeLine?.handle?.stop(0.08);
    this.activeLine = null;
    this.queuedLine = null;
    this.completedLineIds.clear();
    this.elapsedSeconds = 0;
    this.history.length = 0;
    this.lineIndex = 0;
    this.lines = [];
    this.phase = 'idle';
    this.statsViewModel = null;
    this.story = null;
    this.stingerRequested = false;
    this.canContinue = false;
    this.restoreAudio();
    this.overlay.hide();
  }

  getSnapshot(context: {
    gameplayPlayerVisibleCount: number;
    matchSnapshot: MatchSnapshot | null;
    sidelineVisibleCount: number;
  }): HalftimePresentationSnapshot {
    this.updateSpeechState();
    const activeLine = this.activeLine ? serializeActiveLine(this.activeLine, this.options.audio.getCurrentTime()) : null;
    return {
      activeLine,
      activeVoicePack: this.options.voicePackResolver.getSelectedPackId(),
      canContinue: this.canContinue,
      completed: this.phase === 'completed',
      currentLine: activeLine?.lineId ?? null,
      elapsedSeconds: this.elapsedSeconds,
      gameplayPlayerVisibleCount: context.gameplayPlayerVisibleCount,
      history: this.history.map((entry) => ({ ...entry })),
      nextPossession: context.matchSnapshot?.secondHalfPossession ?? 'user',
      phase: this.phase,
      queuedLine: this.queuedLine ? serializeQueuedLine(this.queuedLine) : null,
      selectedStory: this.story ? { ...this.story } : null,
      shotProgress: getHalftimeShotDuration(this.options.cinematics) > 0
        ? Math.min(1, this.elapsedSeconds / getHalftimeShotDuration(this.options.cinematics))
        : 1,
      sidelineVisibleCount: context.sidelineVisibleCount,
      stats: this.statsViewModel,
      targetGameplayCamera: this.options.targetGameplayCamera,
    };
  }

  dispose(): void {
    this.finish();
    this.overlay.dispose();
  }

  private startNextLineIfReady(): void {
    if (this.activeLine || this.lineIndex >= this.lines.length) {
      return;
    }

    const definition = this.lines[this.lineIndex];
    this.lineIndex += 1;
    this.startLine(definition);
  }

  private startLine(definition: HalftimeLineDefinition): void {
    if (this.activeLine) {
      this.queuedLine = definition;
      this.recordHistory(definition.lineId, null, 'queued', null, { scriptId: definition.scriptId });
      return;
    }

    const suppressionReason = this.getPlaybackSuppressionReason();
    if (suppressionReason) {
      this.completedLineIds.add(definition.lineId);
      this.recordHistory(definition.lineId, null, 'suppressed', suppressionReason, {
        scriptId: definition.scriptId,
      });
      return;
    }

    const now = this.options.audio.getCurrentTime();
    this.activeLine = {
      actualEndedAtSeconds: null,
      assetId: null,
      caption: null,
      catalogDurationSeconds: null,
      completed: false,
      endsAtSeconds: now,
      failed: false,
      handle: null,
      lineId: definition.lineId,
      playbackState: 'starting',
      remainingSeconds: 0,
      safetyEndsAtSeconds: null,
      scriptId: definition.scriptId,
      startedAtSeconds: now,
    };
    this.options.audio.setCrowdDuckingGain(HALFTIME_AUDIO_CONFIG.crowdDuckGain);
    this.recordHistory(definition.lineId, null, 'started', null, { scriptId: definition.scriptId });

    void this.options.voicePackResolver.resolveClip(definition.scriptId)
      .then((resolved) => {
        if (!resolved || this.activeLine?.lineId !== definition.lineId) {
          this.suppressActiveLine(definition, 'missingAsset');
          return;
        }

        this.activeLine.assetId = resolved.asset.assetId;
        this.activeLine.caption = resolved.caption;
        this.activeLine.catalogDurationSeconds = resolved.clip.durationSeconds;
        const nowAfterResolve = this.options.audio.getCurrentTime();
        this.activeLine.startedAtSeconds = nowAfterResolve;
        this.activeLine.endsAtSeconds =
          nowAfterResolve + resolved.clip.durationSeconds + HALFTIME_AUDIO_CONFIG.quietGapSeconds;
        this.activeLine.remainingSeconds = resolved.clip.durationSeconds + HALFTIME_AUDIO_CONFIG.quietGapSeconds;
        this.activeLine.safetyEndsAtSeconds =
          nowAfterResolve + resolved.clip.durationSeconds + HALFTIME_AUDIO_CONFIG.safetyTimeoutPaddingSeconds;

        return this.options.audio.playOneShotTracked(resolved.asset.assetId)
          .then((handle) => {
            if (!handle || this.activeLine?.lineId !== definition.lineId) {
              this.suppressActiveLine(definition, 'missingAsset');
              return;
            }
            this.activeLine.handle = handle;
            const duration = Math.max(
              resolved.clip.durationSeconds,
              handle.durationSeconds ?? resolved.clip.durationSeconds,
            );
            this.activeLine.startedAtSeconds = handle.startedAt;
            this.activeLine.endsAtSeconds = handle.startedAt + duration + HALFTIME_AUDIO_CONFIG.quietGapSeconds;
            this.activeLine.safetyEndsAtSeconds =
              handle.startedAt + duration + HALFTIME_AUDIO_CONFIG.safetyTimeoutPaddingSeconds;
            this.activeLine.playbackState = 'playing';
            this.recordHistory(definition.lineId, resolved.asset.assetId, 'played', null, {
              actualStartedAtSeconds: handle.startedAt,
              catalogDurationSeconds: resolved.clip.durationSeconds,
              scriptId: definition.scriptId,
            });
            void handle.ended.then((completion) => {
              this.handlePlaybackEnded(definition.lineId, completion);
            });
          });
      });
  }

  private suppressActiveLine(
    definition: HalftimeLineDefinition,
    reason: HalftimeAudioHistoryEntry['reason'],
  ): void {
    if (this.activeLine?.lineId !== definition.lineId) {
      return;
    }
    this.activeLine.failed = true;
    this.activeLine.playbackState = 'suppressed';
    this.completedLineIds.add(definition.lineId);
    this.recordHistory(definition.lineId, this.activeLine.assetId, 'suppressed', reason, {
      catalogDurationSeconds: this.activeLine.catalogDurationSeconds,
      scriptId: definition.scriptId,
    });
    this.activeLine = null;
    this.restoreAudio();
  }

  private updateSpeechState(): void {
    if (!this.activeLine) {
      if (this.queuedLine) {
        const queued = this.queuedLine;
        this.queuedLine = null;
        this.startLine(queued);
      }
      return;
    }

    const now = this.options.audio.getCurrentTime();
    this.activeLine.remainingSeconds = Math.max(0, this.activeLine.endsAtSeconds - now);
    if (
      this.activeLine.actualEndedAtSeconds === null &&
      this.activeLine.safetyEndsAtSeconds !== null &&
      now >= this.activeLine.safetyEndsAtSeconds
    ) {
      this.activeLine.handle?.stop(0.08);
      this.activeLine.actualEndedAtSeconds = now;
      this.activeLine.endsAtSeconds = now + HALFTIME_AUDIO_CONFIG.quietGapSeconds;
      this.activeLine.playbackState = 'quietGap';
      this.recordHistory(this.activeLine.lineId, this.activeLine.assetId, 'ended', 'safetyTimeout', {
        actualEndedAtSeconds: now,
        actualStartedAtSeconds: this.activeLine.startedAtSeconds,
        catalogDurationSeconds: this.activeLine.catalogDurationSeconds,
        scriptId: this.activeLine.scriptId,
      });
      return;
    }

    if (this.activeLine.actualEndedAtSeconds === null || now < this.activeLine.endsAtSeconds) {
      return;
    }

    const completed = this.activeLine;
    this.completedLineIds.add(completed.lineId);
    this.recordHistory(completed.lineId, completed.assetId, 'completed', null, {
      actualEndedAtSeconds: completed.actualEndedAtSeconds,
      actualStartedAtSeconds: completed.startedAtSeconds,
      catalogDurationSeconds: completed.catalogDurationSeconds,
      scriptId: completed.scriptId,
    });
    this.activeLine = null;
    this.restoreAudio();
  }

  private handlePlaybackEnded(lineId: HalftimeLineId, completion: AudioPlaybackCompletion): void {
    if (!this.activeLine || this.activeLine.lineId !== lineId) {
      return;
    }

    this.activeLine.actualEndedAtSeconds = completion.endedAt;
    this.activeLine.endsAtSeconds = completion.endedAt + HALFTIME_AUDIO_CONFIG.quietGapSeconds;
    this.activeLine.playbackState = 'quietGap';
    this.activeLine.remainingSeconds =
      Math.max(0, this.activeLine.endsAtSeconds - this.options.audio.getCurrentTime());
    this.recordHistory(lineId, completion.assetId, 'ended', completion.reason, {
      actualEndedAtSeconds: completion.endedAt,
      actualStartedAtSeconds: completion.startedAt,
      catalogDurationSeconds: this.activeLine.catalogDurationSeconds,
      scriptId: this.activeLine.scriptId,
    });
  }

  private getPlaybackSuppressionReason(): HalftimeAudioHistoryEntry['reason'] {
    const snapshot = this.options.audio.getSnapshot();
    if (!snapshot.enabled) {
      return 'audioDisabled';
    }
    if (!snapshot.announcerEnabled) {
      return 'announcerDisabled';
    }
    if (snapshot.muted) {
      return 'muted';
    }
    if (snapshot.contextState !== 'running') {
      return 'suspended';
    }
    return null;
  }

  private restoreAudio(): void {
    this.options.audio.setCrowdDuckingGain(1);
  }

  private recordHistory(
    lineId: HalftimeLineId,
    assetId: string | null,
    status: HalftimeAudioHistoryEntry['status'],
    reason: HalftimeAudioHistoryEntry['reason'],
    timing: {
      actualEndedAtSeconds?: number | null;
      actualStartedAtSeconds?: number | null;
      catalogDurationSeconds?: number | null;
      scriptId?: BroadcastScriptId | null;
    } = {},
  ): void {
    this.history.unshift({
      actualEndedAtSeconds: timing.actualEndedAtSeconds,
      actualStartedAtSeconds: timing.actualStartedAtSeconds,
      assetId,
      catalogDurationSeconds: timing.catalogDurationSeconds,
      lineId,
      reason,
      scriptId: timing.scriptId ?? null,
      status,
      timeSeconds: this.options.audio.getCurrentTime(),
    });
    this.history.splice(24);
  }
}

function selectHalftimeUtilityScript(
  category: 'halftimeOpening' | 'secondHalfTransition',
  seed: number,
): BroadcastScriptId {
  const ids = HALFTIME_SCRIPT_IDS[category];
  return ids[Math.abs(seed) % ids.length];
}

function createMatchHalftimeKey(match: MatchSnapshot): string {
  return `${match.deterministicSeed}:q${match.quarter}:drive${match.driveNumber}`;
}

function serializeActiveLine(line: ActiveHalftimeLine, now: number): HalftimeAudioLineSnapshot {
  return {
    actualEndedAtSeconds: line.actualEndedAtSeconds,
    assetId: line.assetId,
    caption: line.caption,
    catalogDurationSeconds: line.catalogDurationSeconds,
    completed: line.completed,
    failed: line.failed,
    lineId: line.lineId,
    playbackState: line.playbackState,
    remainingSeconds: Math.max(0, line.endsAtSeconds - now),
    safetyEndsAtSeconds: line.safetyEndsAtSeconds,
    scriptId: line.scriptId,
    startedAtSeconds: line.startedAtSeconds,
  };
}

function serializeQueuedLine(line: HalftimeLineDefinition): HalftimeAudioLineSnapshot {
  return {
    actualEndedAtSeconds: null,
    assetId: null,
    caption: null,
    catalogDurationSeconds: null,
    completed: false,
    failed: false,
    lineId: line.lineId,
    playbackState: 'queued',
    remainingSeconds: 0,
    safetyEndsAtSeconds: null,
    scriptId: line.scriptId,
    startedAtSeconds: null,
  };
}
