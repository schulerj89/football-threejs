import type { AudioMixerSnapshot } from '../../audio/AudioMixer';
import type {
  AudioPlaybackCompletion,
  AudioPlaybackHandle,
} from '../../audio/AudioMixer';
import type { AudioPlaybackCategory } from '../../audio/AudioAssetManifest';
import type { GameAudioDirector } from '../../audio/GameAudioDirector';
import {
  resolveMatchupLine,
  resolvePregameWelcome,
  resolveQuarterbackSpotlight,
  resolveWeatherLine,
  type PregameCommentarySelection,
  type PregameWeatherCondition,
} from '../../audio/PregameCommentaryCatalog';
import type { AudioSettings } from '../../audio/AudioSettings';
import type { TitleMusicControllerSnapshot } from '../../audio/TitleMusicController';
import type { VoicePackAssetResolver } from '../../audio/voicePacks/VoicePackAssetResolver';
import type { GameplaySnapshot } from '../../playState';
import type { MatchSnapshot } from '../../match/MatchTypes';
import type {
  PregameAudioCoordinatorSnapshot,
  PregameAudioLineSnapshot,
  PregameCommentaryLineId,
  PregameCommentarySelections,
} from './PregamePresentationTypes';

export interface PregameAudioPort {
  getCurrentTime(): number;
  getSnapshot(): AudioMixerSnapshot;
  playOneShot(assetId: string): Promise<boolean>;
  playOneShotTracked?(assetId: string): Promise<AudioPlaybackHandle | null>;
  setCrowdDuckingGain(gain: number): void;
  setSettings(patch: Partial<AudioSettings>): AudioSettings;
  stopOneShotsByCategory(category: AudioPlaybackCategory): number;
}

export interface PregameTitleMusicPort {
  fadeOutForGameplay(rampSeconds?: number): void;
  getSnapshot(): TitleMusicControllerSnapshot;
  setPregameDucking(ducked: boolean, duckGain?: number, rampSeconds?: number): void;
}

export interface PregameAudioCoordinatorOptions {
  activeSpeechPaddingSeconds?: number;
  crowdDuckGain?: number;
  quietGapSeconds?: number;
  safetyTimeoutPaddingSeconds?: number;
  titleMusicDuckGain?: number;
  voicePackResolver?: VoicePackAssetResolver;
}

interface ActivePregameLine extends PregameAudioLineSnapshot {
  handle: AudioPlaybackHandle | null;
  endsAtSeconds: number;
  startedAtSeconds: number;
}

interface QueuedPregameLine {
  lineId: PregameCommentaryLineId;
  selection: PregameCommentarySelection;
}

const DEFAULT_PREGAME_AUDIO_CONFIG = {
  crowdDuckGain: 0.78,
  quietGapSeconds: 0.85,
  safetyTimeoutPaddingSeconds: 3,
  titleMusicDuckGain: 0.34,
} as const;

export class PregameAudioCoordinator {
  private readonly crowdDuckGain: number;
  private readonly history: PregameAudioCoordinatorSnapshot['history'] = [];
  private readonly pendingAudioTasks: Promise<void>[] = [];
  private readonly quietGapSeconds: number;
  private readonly safetyTimeoutPaddingSeconds: number;
  private readonly titleMusicDuckGain: number;
  private readonly voicePackResolver: VoicePackAssetResolver | null;
  private activeLine: ActivePregameLine | null = null;
  private queuedLine: QueuedPregameLine | null = null;
  private readonly completedLineIds = new Set<PregameCommentaryLineId>();
  private readonly failedLineIds = new Set<PregameCommentaryLineId>();
  private readonly requestedLineIds = new Set<PregameCommentaryLineId>();
  private readonly startedLineIds = new Set<PregameCommentaryLineId>();

  constructor(
    private readonly mixer: PregameAudioPort,
    private readonly titleMusic: PregameTitleMusicPort,
    private readonly gameAudioDirector: GameAudioDirector,
    options: PregameAudioCoordinatorOptions = {},
  ) {
    this.crowdDuckGain = options.crowdDuckGain ?? DEFAULT_PREGAME_AUDIO_CONFIG.crowdDuckGain;
    this.quietGapSeconds = options.quietGapSeconds ??
      options.activeSpeechPaddingSeconds ??
      DEFAULT_PREGAME_AUDIO_CONFIG.quietGapSeconds;
    this.safetyTimeoutPaddingSeconds =
      options.safetyTimeoutPaddingSeconds ?? DEFAULT_PREGAME_AUDIO_CONFIG.safetyTimeoutPaddingSeconds;
    this.titleMusicDuckGain = options.titleMusicDuckGain ?? DEFAULT_PREGAME_AUDIO_CONFIG.titleMusicDuckGain;
    this.voicePackResolver = options.voicePackResolver ?? null;
  }

  createSelections(options: {
    matchSnapshot: MatchSnapshot | null;
    previousScriptIds?: Partial<Record<PregameCommentaryLineId, string | null>>;
    quarterbackRosterPlayerId?: string | null;
    quarterbackTeamId?: string | null;
    weatherCondition: PregameWeatherCondition;
  }): PregameCommentarySelections {
    const matchSeed = options.matchSnapshot?.deterministicSeed ?? 'pregame';
    const userTeamId = options.matchSnapshot?.userTeam.id ?? null;
    const opponentTeamId = options.matchSnapshot?.opponentTeam.id ?? null;

    return {
      matchup: resolveMatchupLine({
        awayTeamId: opponentTeamId,
        homeTeamId: userTeamId,
        matchSeed,
        previousScriptId: options.previousScriptIds?.matchup ?? null,
      }),
      quarterback: resolveQuarterbackSpotlight({
        matchSeed,
        previousScriptId: options.previousScriptIds?.quarterback ?? null,
        rosterPlayerId: options.quarterbackRosterPlayerId ?? null,
        teamId: options.quarterbackTeamId ?? userTeamId,
      }),
      weather: resolveWeatherLine({
        condition: options.weatherCondition,
        matchSeed,
        previousScriptId: options.previousScriptIds?.weather ?? null,
      }),
      welcome: resolvePregameWelcome({
        matchSeed,
        previousScriptId: options.previousScriptIds?.welcome ?? null,
      }),
    };
  }

  updateAmbience(snapshot: GameplaySnapshot, deltaSeconds: number): void {
    this.gameAudioDirector.processEvents(snapshot, [], deltaSeconds);
    this.updateSpeechState();
  }

  startLine(lineId: PregameCommentaryLineId, selection: PregameCommentarySelection): void {
    this.updateSpeechState();

    if (
      this.requestedLineIds.has(lineId) ||
      this.completedLineIds.has(lineId) ||
      this.failedLineIds.has(lineId)
    ) {
      return;
    }

    this.requestedLineIds.add(lineId);
    if (this.activeLine) {
      this.queuedLine = { lineId, selection };
      this.recordHistory(lineId, selection.assetId, 'queued', 'activeLine');
      return;
    }

    this.startLineNow(lineId, selection);
  }

  private startLineNow(
    lineId: PregameCommentaryLineId,
    selection: PregameCommentarySelection,
  ): void {
    this.startedLineIds.add(lineId);

    if (!selection.assetId || !selection.clip) {
      this.failedLineIds.add(lineId);
      this.completedLineIds.add(lineId);
      this.recordHistory(lineId, selection.assetId, 'suppressed', selection.fallbackReason ?? 'missingAsset', {
        catalogDurationSeconds: null,
      });
      return;
    }
    const clip = selection.clip;

    const suppressionReason = this.getPlaybackSuppressionReason();
    if (suppressionReason) {
      this.failedLineIds.add(lineId);
      this.completedLineIds.add(lineId);
      this.recordHistory(lineId, selection.assetId, 'suppressed', suppressionReason, {
        catalogDurationSeconds: selection.clip.durationSeconds,
      });
      return;
    }

    const now = this.mixer.getCurrentTime();
    this.activeLine = {
      actualEndedAtSeconds: null,
      assetId: selection.assetId,
      catalogDurationSeconds: clip.durationSeconds,
      caption: selection.caption,
      completed: false,
      endsAtSeconds: now + clip.durationSeconds + this.quietGapSeconds,
      failed: false,
      handle: null,
      lineId,
      playbackState: 'starting',
      remainingSeconds: clip.durationSeconds + this.quietGapSeconds,
      safetyEndsAtSeconds: now + clip.durationSeconds + this.safetyTimeoutPaddingSeconds,
      started: true,
      startedAtSeconds: now,
    };
    this.titleMusic.setPregameDucking(true, this.titleMusicDuckGain);
    this.mixer.setCrowdDuckingGain(this.crowdDuckGain);
    this.recordHistory(lineId, selection.assetId, 'started', null, {
      actualStartedAtSeconds: now,
      catalogDurationSeconds: clip.durationSeconds,
    });

    const staticPlayable = this.voicePackResolver
      ? null
      : {
        assetId: selection.assetId ?? clip.assetId,
        caption: selection.caption,
        durationSeconds: clip.durationSeconds,
      };
    const task = staticPlayable
      ? this.playResolvedLine(lineId, selection, staticPlayable)
      : this.resolvePlayableSelection(selection)
        .then((playable) => this.playResolvedLine(lineId, selection, playable));
    this.pendingAudioTasks.push(task);
  }

  private playResolvedLine(
    lineId: PregameCommentaryLineId,
    selection: PregameCommentarySelection,
    playable: { assetId: string; caption: string; durationSeconds: number } | null,
  ): Promise<void> {
    if (!playable) {
      if (this.activeLine?.lineId === lineId) {
        const activeAssetId = this.activeLine.assetId;
        this.failedLineIds.add(lineId);
        this.completedLineIds.add(lineId);
        this.activeLine = null;
        this.restoreDucking();
        this.recordHistory(lineId, activeAssetId, 'suppressed', 'missingAsset', {
          catalogDurationSeconds: selection.clip?.durationSeconds ?? null,
        });
        this.startQueuedLineIfReady();
      }
      return Promise.resolve();
    }

    if (this.activeLine?.lineId === lineId && this.activeLine.actualEndedAtSeconds === null) {
      const nowAfterResolve = this.mixer.getCurrentTime();
      this.activeLine.assetId = playable.assetId;
      this.activeLine.caption = playable.caption;
      this.activeLine.catalogDurationSeconds = playable.durationSeconds;
      this.activeLine.endsAtSeconds = nowAfterResolve + playable.durationSeconds + this.quietGapSeconds;
      this.activeLine.remainingSeconds = playable.durationSeconds + this.quietGapSeconds;
      this.activeLine.safetyEndsAtSeconds =
        nowAfterResolve + playable.durationSeconds + this.safetyTimeoutPaddingSeconds;
    }

    return this.playTrackedOneShot(playable.assetId)
      .then((handle) => {
        if (!handle) {
          if (this.activeLine?.lineId === lineId) {
            const activeAssetId = this.activeLine.assetId;
            this.failedLineIds.add(lineId);
            this.completedLineIds.add(lineId);
            this.activeLine = null;
            this.restoreDucking();
            this.recordHistory(lineId, activeAssetId, 'suppressed', 'missingAsset', {
              catalogDurationSeconds: playable.durationSeconds,
            });
            this.startQueuedLineIfReady();
          }
          return;
        }

        if (this.activeLine?.lineId !== lineId || this.activeLine.actualEndedAtSeconds !== null) {
          handle.stop(0.02);
          return;
        }

        this.activeLine.handle = handle;
        const expectedPlaybackSeconds = Math.max(
          playable.durationSeconds,
          handle.durationSeconds ?? playable.durationSeconds,
        );
        this.activeLine.startedAtSeconds = handle.startedAt;
        this.activeLine.safetyEndsAtSeconds =
          handle.startedAt + expectedPlaybackSeconds + this.safetyTimeoutPaddingSeconds;
        this.activeLine.endsAtSeconds =
          handle.startedAt + expectedPlaybackSeconds + this.quietGapSeconds;
        this.activeLine.playbackState = 'playing';
        this.recordHistory(lineId, playable.assetId, 'played', null, {
          actualStartedAtSeconds: handle.startedAt,
          catalogDurationSeconds: playable.durationSeconds,
        });

        const completionTask = handle.ended.then((completion) => {
          this.handlePlaybackEnded(lineId, completion);
        });
        this.pendingAudioTasks.push(completionTask);
      });
  }

  isLineComplete(lineId: PregameCommentaryLineId): boolean {
    return this.completedLineIds.has(lineId) || this.failedLineIds.has(lineId);
  }

  fadeTitleMusicToGameplay(rampSeconds = 1.4): void {
    this.titleMusic.fadeOutForGameplay(rampSeconds);
  }

  skip(): void {
    if (this.activeLine) {
      this.recordHistory(this.activeLine.lineId, this.activeLine.assetId, 'skipped', 'skip');
      this.activeLine.handle?.stop(0.08);
    }
    this.mixer.stopOneShotsByCategory('announcer');
    this.activeLine = null;
    this.queuedLine = null;
    this.completedLineIds.clear();
    this.failedLineIds.clear();
    this.requestedLineIds.clear();
    this.startedLineIds.clear();
    this.restoreDucking();
    this.titleMusic.fadeOutForGameplay(0.35);
  }

  reset(): void {
    this.activeLine?.handle?.stop(0.08);
    this.activeLine = null;
    this.queuedLine = null;
    this.completedLineIds.clear();
    this.failedLineIds.clear();
    this.requestedLineIds.clear();
    this.startedLineIds.clear();
    this.restoreDucking();
  }

  getSnapshot(): PregameAudioCoordinatorSnapshot {
    this.updateSpeechState();
    const mixerSnapshot = this.mixer.getSnapshot();
    const titleMusicSnapshot = this.titleMusic.getSnapshot();
    return {
      activeLine: this.activeLine ? serializeActiveLine(this.activeLine, this.mixer.getCurrentTime()) : null,
      completedLineIds: [...this.completedLineIds].sort(),
      crowdActiveLoopIds: mixerSnapshot.activeLoops.filter((assetId) => assetId.startsWith('crowd_')),
      crowdDuckingGain: mixerSnapshot.crowdDuckingGain,
      crowdGain: mixerSnapshot.busGains.crowd,
      failedLineIds: [...this.failedLineIds].sort(),
      history: this.history.map((entry) => ({ ...entry })),
      musicGain: titleMusicSnapshot.loopGain,
      musicLoopActive: titleMusicSnapshot.loopActive,
      musicState: titleMusicSnapshot.state,
      playbackState: normalizeCoordinatorPlaybackState(this.activeLine?.playbackState) ??
        (this.queuedLine ? 'queued' : 'idle'),
      queuedLine: this.queuedLine
        ? serializeQueuedLine(this.queuedLine, this.mixer.getCurrentTime())
        : null,
    };
  }

  async flushPendingAudioForTests(): Promise<void> {
    await Promise.all(this.pendingAudioTasks);
    this.pendingAudioTasks.length = 0;
  }

  private async playTrackedOneShot(assetId: string): Promise<AudioPlaybackHandle | null> {
    if (this.mixer.playOneShotTracked) {
      return this.mixer.playOneShotTracked(assetId);
    }

    const played = await this.mixer.playOneShot(assetId);
    if (!played) {
      return null;
    }

    const startedAt = this.mixer.getCurrentTime();
    let stopped = false;
    let resolveCompletion: (completion: AudioPlaybackCompletion) => void = () => undefined;
    const ended = new Promise<AudioPlaybackCompletion>((resolve) => {
      resolveCompletion = resolve;
    });
    return {
      assetId,
      category: 'announcer',
      ended,
      startedAt,
      stop: () => {
        stopped = true;
        resolveCompletion({
          assetId,
          category: 'announcer',
          endedAt: this.mixer.getCurrentTime(),
          reason: 'stopped',
          startedAt,
          stopped,
        });
      },
    };
  }

  private async resolvePlayableSelection(
    selection: PregameCommentarySelection,
  ): Promise<{ assetId: string; caption: string; durationSeconds: number } | null> {
    if (!selection.clip) {
      return null;
    }

    if (!this.voicePackResolver) {
      return {
        assetId: selection.assetId ?? selection.clip.assetId,
        caption: selection.caption,
        durationSeconds: selection.clip.durationSeconds,
      };
    }

    const resolved = await this.voicePackResolver.resolveClip(selection.clip.scriptId);
    if (!resolved) {
      return null;
    }

    return {
      assetId: resolved.asset.assetId,
      caption: resolved.caption,
      durationSeconds: resolved.clip.durationSeconds || selection.clip.durationSeconds,
    };
  }

  private updateSpeechState(): void {
    if (!this.activeLine) {
      this.startQueuedLineIfReady();
      return;
    }

    const now = this.mixer.getCurrentTime();
    this.activeLine.remainingSeconds = Math.max(0, this.activeLine.endsAtSeconds - now);
    if (
      this.activeLine.actualEndedAtSeconds === null &&
      this.activeLine.safetyEndsAtSeconds !== null &&
      now >= this.activeLine.safetyEndsAtSeconds
    ) {
      this.activeLine.handle?.stop(0.08);
      this.activeLine.actualEndedAtSeconds = now;
      this.activeLine.endsAtSeconds = now + this.quietGapSeconds;
      this.activeLine.playbackState = 'quietGap';
      this.recordHistory(this.activeLine.lineId, this.activeLine.assetId, 'ended', 'safetyTimeout', {
        actualEndedAtSeconds: now,
        actualStartedAtSeconds: this.activeLine.startedAtSeconds,
        catalogDurationSeconds: this.activeLine.catalogDurationSeconds,
      });
      return;
    }

    if (this.activeLine.actualEndedAtSeconds === null || now < this.activeLine.endsAtSeconds) {
      return;
    }

    const completedLine = this.activeLine;
    this.completedLineIds.add(completedLine.lineId);
    this.recordHistory(completedLine.lineId, completedLine.assetId, 'completed', null, {
      actualEndedAtSeconds: completedLine.actualEndedAtSeconds,
      actualStartedAtSeconds: completedLine.startedAtSeconds,
      catalogDurationSeconds: completedLine.catalogDurationSeconds,
    });
    this.activeLine = null;
    this.restoreDucking();
    this.startQueuedLineIfReady();
  }

  private handlePlaybackEnded(
    lineId: PregameCommentaryLineId,
    completion: AudioPlaybackCompletion,
  ): void {
    if (!this.activeLine || this.activeLine.lineId !== lineId) {
      return;
    }

    this.activeLine.actualEndedAtSeconds = completion.endedAt;
    this.activeLine.endsAtSeconds = completion.endedAt + this.quietGapSeconds;
    this.activeLine.playbackState = 'quietGap';
    this.activeLine.remainingSeconds = Math.max(0, this.activeLine.endsAtSeconds - this.mixer.getCurrentTime());
    this.recordHistory(lineId, completion.assetId, 'ended', completion.reason, {
      actualEndedAtSeconds: completion.endedAt,
      actualStartedAtSeconds: completion.startedAt,
      catalogDurationSeconds: this.activeLine.catalogDurationSeconds,
    });
  }

  private startQueuedLineIfReady(): void {
    if (this.activeLine || !this.queuedLine) {
      return;
    }

    const queued = this.queuedLine;
    this.queuedLine = null;
    this.startLineNow(queued.lineId, queued.selection);
  }

  private getPlaybackSuppressionReason(): string | null {
    const snapshot = this.mixer.getSnapshot();

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

  private restoreDucking(): void {
    this.titleMusic.setPregameDucking(false);
    this.mixer.setCrowdDuckingGain(1);
  }

  private recordHistory(
    lineId: PregameCommentaryLineId,
    assetId: string | null,
    status: PregameAudioCoordinatorSnapshot['history'][number]['status'],
    reason: string | null,
    timing: {
      actualEndedAtSeconds?: number | null;
      actualStartedAtSeconds?: number | null;
      catalogDurationSeconds?: number | null;
    } = {},
  ): void {
    this.history.unshift({
      actualEndedAtSeconds: timing.actualEndedAtSeconds,
      actualStartedAtSeconds: timing.actualStartedAtSeconds,
      assetId,
      catalogDurationSeconds: timing.catalogDurationSeconds,
      lineId,
      reason,
      status,
      timeSeconds: this.mixer.getCurrentTime(),
    });
    this.history.splice(20);
  }
}

function serializeActiveLine(
  line: ActivePregameLine,
  now: number,
): PregameAudioLineSnapshot {
  return {
    actualEndedAtSeconds: line.actualEndedAtSeconds,
    assetId: line.assetId,
    catalogDurationSeconds: line.catalogDurationSeconds,
    caption: line.caption,
    completed: line.completed,
    failed: line.failed,
    lineId: line.lineId,
    playbackState: line.playbackState,
    remainingSeconds: Math.max(0, line.endsAtSeconds - now),
    safetyEndsAtSeconds: line.safetyEndsAtSeconds,
    started: line.started,
    startedAtSeconds: line.startedAtSeconds,
  };
}

function serializeQueuedLine(
  line: QueuedPregameLine,
  _now: number,
): PregameAudioLineSnapshot {
  return {
    actualEndedAtSeconds: null,
    assetId: line.selection.assetId,
    catalogDurationSeconds: line.selection.clip?.durationSeconds ?? null,
    caption: line.selection.caption,
    completed: false,
    failed: false,
    lineId: line.lineId,
    playbackState: 'queued',
    remainingSeconds: line.selection.clip?.durationSeconds ?? 0,
    safetyEndsAtSeconds: null,
    started: false,
    startedAtSeconds: null,
  };
}

function normalizeCoordinatorPlaybackState(
  state: PregameAudioLineSnapshot['playbackState'] | undefined,
): PregameAudioCoordinatorSnapshot['playbackState'] | null {
  if (!state || state === 'failed' || state === 'suppressed') {
    return null;
  }
  return state;
}
