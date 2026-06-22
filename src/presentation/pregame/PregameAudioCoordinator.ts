import type { AudioMixerSnapshot } from '../../audio/AudioMixer';
import type { AudioPlaybackCategory } from '../../audio/AudioAssetManifest';
import type { GameAudioDirector } from '../../audio/GameAudioDirector';
import {
  resolveMatchupLine,
  resolvePregameWelcome,
  resolveWeatherLine,
  type PregameCommentarySelection,
  type PregameWeatherCondition,
} from '../../audio/PregameCommentaryCatalog';
import type { AudioSettings } from '../../audio/AudioSettings';
import type { TitleMusicController } from '../../audio/TitleMusicController';
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
  setCrowdDuckingGain(gain: number): void;
  setSettings(patch: Partial<AudioSettings>): AudioSettings;
  stopOneShotsByCategory(category: AudioPlaybackCategory): number;
}

export interface PregameAudioCoordinatorOptions {
  activeSpeechPaddingSeconds?: number;
  crowdDuckGain?: number;
  titleMusicDuckGain?: number;
}

interface ActivePregameLine extends PregameAudioLineSnapshot {
  endsAtSeconds: number;
  startedAtSeconds: number;
}

const DEFAULT_PREGAME_AUDIO_CONFIG = {
  activeSpeechPaddingSeconds: 0.18,
  crowdDuckGain: 0.78,
  titleMusicDuckGain: 0.34,
} as const;

export class PregameAudioCoordinator {
  private readonly activeSpeechPaddingSeconds: number;
  private readonly crowdDuckGain: number;
  private readonly history: PregameAudioCoordinatorSnapshot['history'] = [];
  private readonly pendingAudioTasks: Promise<void>[] = [];
  private readonly titleMusicDuckGain: number;
  private activeLine: ActivePregameLine | null = null;
  private readonly completedLineIds = new Set<PregameCommentaryLineId>();
  private readonly failedLineIds = new Set<PregameCommentaryLineId>();
  private readonly startedLineIds = new Set<PregameCommentaryLineId>();

  constructor(
    private readonly mixer: PregameAudioPort,
    private readonly titleMusic: TitleMusicController,
    private readonly gameAudioDirector: GameAudioDirector,
    options: PregameAudioCoordinatorOptions = {},
  ) {
    this.activeSpeechPaddingSeconds =
      options.activeSpeechPaddingSeconds ?? DEFAULT_PREGAME_AUDIO_CONFIG.activeSpeechPaddingSeconds;
    this.crowdDuckGain = options.crowdDuckGain ?? DEFAULT_PREGAME_AUDIO_CONFIG.crowdDuckGain;
    this.titleMusicDuckGain = options.titleMusicDuckGain ?? DEFAULT_PREGAME_AUDIO_CONFIG.titleMusicDuckGain;
  }

  createSelections(options: {
    matchSnapshot: MatchSnapshot | null;
    previousScriptIds?: Partial<Record<PregameCommentaryLineId, string | null>>;
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
    this.finishExpiredSpeech();
  }

  startLine(lineId: PregameCommentaryLineId, selection: PregameCommentarySelection): void {
    if (this.startedLineIds.has(lineId)) {
      return;
    }

    this.startedLineIds.add(lineId);

    if (!selection.assetId || !selection.clip) {
      this.failedLineIds.add(lineId);
      this.completedLineIds.add(lineId);
      this.recordHistory(lineId, selection.assetId, 'suppressed', selection.fallbackReason ?? 'missingAsset');
      return;
    }

    const suppressionReason = this.getPlaybackSuppressionReason();
    if (suppressionReason) {
      this.failedLineIds.add(lineId);
      this.completedLineIds.add(lineId);
      this.recordHistory(lineId, selection.assetId, 'suppressed', suppressionReason);
      return;
    }

    const now = this.mixer.getCurrentTime();
    this.activeLine = {
      assetId: selection.assetId,
      caption: selection.caption,
      completed: false,
      endsAtSeconds: now + selection.clip.durationSeconds + this.activeSpeechPaddingSeconds,
      failed: false,
      lineId,
      remainingSeconds: selection.clip.durationSeconds + this.activeSpeechPaddingSeconds,
      started: true,
      startedAtSeconds: now,
    };
    this.titleMusic.setPregameDucking(true, this.titleMusicDuckGain);
    this.mixer.setCrowdDuckingGain(this.crowdDuckGain);
    this.recordHistory(lineId, selection.assetId, 'started', null);

    const task = this.mixer.playOneShot(selection.assetId)
      .then((played) => {
        if (!played && this.activeLine?.lineId === lineId) {
          this.failedLineIds.add(lineId);
          this.completedLineIds.add(lineId);
          this.activeLine = null;
          this.restoreDucking();
          this.recordHistory(lineId, selection.assetId, 'suppressed', 'missingAsset');
          return;
        }

        if (played) {
          this.recordHistory(lineId, selection.assetId, 'played', null);
        }
      });
    this.pendingAudioTasks.push(task);
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
    }
    this.mixer.stopOneShotsByCategory('announcer');
    this.activeLine = null;
    this.completedLineIds.clear();
    this.failedLineIds.clear();
    this.startedLineIds.clear();
    this.restoreDucking();
    this.titleMusic.fadeOutForGameplay(0.35);
  }

  reset(): void {
    this.activeLine = null;
    this.completedLineIds.clear();
    this.failedLineIds.clear();
    this.startedLineIds.clear();
    this.restoreDucking();
  }

  getSnapshot(): PregameAudioCoordinatorSnapshot {
    this.finishExpiredSpeech();
    const mixerSnapshot = this.mixer.getSnapshot();
    return {
      activeLine: this.activeLine ? serializeActiveLine(this.activeLine, this.mixer.getCurrentTime()) : null,
      completedLineIds: [...this.completedLineIds].sort(),
      crowdGain: mixerSnapshot.busGains.crowd,
      failedLineIds: [...this.failedLineIds].sort(),
      history: this.history.map((entry) => ({ ...entry })),
      musicGain: this.titleMusic.getSnapshot().loopGain,
    };
  }

  async flushPendingAudioForTests(): Promise<void> {
    await Promise.all(this.pendingAudioTasks);
    this.pendingAudioTasks.length = 0;
  }

  private finishExpiredSpeech(): void {
    if (!this.activeLine) {
      return;
    }

    const now = this.mixer.getCurrentTime();
    this.activeLine.remainingSeconds = Math.max(0, this.activeLine.endsAtSeconds - now);
    if (now < this.activeLine.endsAtSeconds) {
      return;
    }

    this.completedLineIds.add(this.activeLine.lineId);
    this.recordHistory(this.activeLine.lineId, this.activeLine.assetId, 'completed', null);
    this.activeLine = null;
    this.restoreDucking();
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
  ): void {
    this.history.unshift({
      assetId,
      lineId,
      reason,
      status,
    });
    this.history.splice(20);
  }
}

function serializeActiveLine(
  line: ActivePregameLine,
  now: number,
): PregameAudioLineSnapshot {
  return {
    assetId: line.assetId,
    caption: line.caption,
    completed: false,
    failed: line.failed,
    lineId: line.lineId,
    remainingSeconds: Math.max(0, line.endsAtSeconds - now),
    started: line.started,
  };
}
