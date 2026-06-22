import { describe, expect, it } from 'vitest';
import {
  createCoinTossState,
  createResolvedCoinToss,
  enterOpeningCoinToss,
  resolveCoinTossFace,
  resolveOpeningCoinToss,
} from '../src/match/CoinTossModel';
import {
  createMatchModel,
  enterCoinToss,
  resolveMatchCoinToss,
  snapshotMatchModel,
} from '../src/match/MatchModel';
import { MatchFlowController } from '../src/match/MatchFlowController';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
} from '../src/teams/TeamRegistry';
import { BROADCAST_EXPERIENCE_SETTINGS } from '../src/config/GameExperienceSettings';
import { createGameplayRosterBinding } from '../src/roster/GameplayRosterBinding';
import {
  createCoinTossLayout,
  validateCoinTossLayout,
} from '../src/presentation/coinToss/CoinTossLayout';
import { resolveCoinFinalRotationX } from '../src/presentation/coinToss/CoinTossVisualFactory';
import {
  PregameAudioCoordinator,
  type PregameAudioPort,
} from '../src/presentation/pregame/PregameAudioCoordinator';
import type {
  AudioMixerSnapshot,
  AudioPlaybackCompletion,
  AudioPlaybackHandle,
} from '../src/audio/AudioMixer';
import type { TitleMusicController } from '../src/audio/TitleMusicController';
import type { GameAudioDirector } from '../src/audio/GameAudioDirector';

describe('opening coin toss model', () => {
  it('uses the match seed and toss index for a deterministic face', () => {
    expect(resolveCoinTossFace(20260622, 0)).toBe(resolveCoinTossFace(20260622, 0));
    expect(resolveCoinTossFace(20260622, 0)).not.toBe(resolveCoinTossFace(20260622, 1));
  });

  it('produces both fair outcomes across valid seeds', () => {
    const faces = new Set(
      Array.from({ length: 40 }, (_, index) => resolveCoinTossFace(1000 + index, 0)),
    );

    expect(faces).toEqual(new Set(['heads', 'tails']));
  });

  it('does not let the player choice change the seeded face distribution', () => {
    const headsCall = createResolvedCoinToss(20260622, 'heads');
    const tailsCall = createResolvedCoinToss(20260622, 'tails');

    expect(headsCall.resolvedFace).toBe(tailsCall.resolvedFace);
    expect(headsCall.winner).not.toBe(tailsCall.winner);
  });

  it('resolves once and preserves the original call/result', () => {
    const awaiting = enterOpeningCoinToss(createCoinTossState());
    const first = resolveOpeningCoinToss(awaiting, 77, 'heads');
    const second = resolveOpeningCoinToss(first, 77, 'tails');

    expect(first.completed).toBe(true);
    expect(second).toEqual(first);
  });

  it('updates authoritative match possession fields from the toss', () => {
    const match = createMatchModel({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      rules: { seed: 20260622 },
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    enterCoinToss(match);
    const toss = resolveMatchCoinToss(match, 'heads');

    expect(snapshotMatchModel(match)).toMatchObject({
      coinToss: toss,
      openingPossession: toss.firstHalfOpeningPossession,
      phase: 'coinToss',
      secondHalfPossession: toss.secondHalfOpeningPossession,
    });
    expect(match.secondHalfPossession).not.toBe(match.openingPossession);
  });

  it('controller handoff begins possession only after the toss is resolved', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = new MatchFlowController({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      seed: 20260622,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });

    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    expect(controller.canStartPlay(snapshotGameplayModel(gameplay))).toBe(false);

    const toss = controller.resolveOpeningCoinToss('heads');
    controller.beginAfterCoinToss(gameplay);
    const snapshot = controller.getSnapshot();

    expect(snapshot.coinToss.completed).toBe(true);
    expect(snapshot.openingPossession).toBe(toss.firstHalfOpeningPossession);
    expect(snapshot.phase).toBe(
      toss.firstHalfOpeningPossession === 'user'
        ? 'userPossession'
        : 'opponentDriveSimulation',
    );
  });

  it('returning to title/resetting the match clears the toss', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const controller = new MatchFlowController({
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      seed: 20260622,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });

    controller.prepareForPregame(gameplay);
    controller.enterCoinToss();
    controller.resolveOpeningCoinToss('heads');
    expect(controller.getSnapshot().coinToss.completed).toBe(true);

    controller.prepareForPregame(gameplay);
    expect(controller.getSnapshot().coinToss).toMatchObject({
      completed: false,
      phase: 'notStarted',
      userCall: null,
      winner: null,
    });
  });

  it('leaves score attack regression mode outside the match toss path', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'scoreAttack',
      playbookId: '5v5',
    });

    expect(gameplay.challengeMode).toBe('scoreAttack');
  });
});

describe('coin toss presentation data', () => {
  it('creates four captains and one presentation-only referee without gameplay authority', () => {
    const binding = createGameplayRosterBinding(
      '11v11',
      BROADCAST_EXPERIENCE_SETTINGS.teamProfiles,
    );
    const layout = createCoinTossLayout(binding);

    expect(validateCoinTossLayout(layout)).toEqual([]);
    expect(layout.noGameplayAuthority).toBe(true);
    expect(layout.captains).toHaveLength(4);
    expect(layout.captainPlacements).toHaveLength(4);
    expect(layout.officials).toHaveLength(1);
    expect(layout.officials[0]?.id).toBe('official-referee');
    expect(binding.activeLineup.bindings.map((entry) => entry.gameplayPlayerId)).not.toContain(
      'coin-toss-captain-user-1',
    );
  });

  it('ends the visual animation with the requested face up', () => {
    expect(resolveCoinFinalRotationX('heads')).toBe(0);
    expect(resolveCoinFinalRotationX('tails')).toBeCloseTo(Math.PI, 8);
  });
});

describe('coin toss announcer sequencing', () => {
  it('queues the result line behind the setup line instead of overlapping it', async () => {
    const mixer = new FakePregameMixer();
    const coordinator = new PregameAudioCoordinator(
      mixer,
      createFakeTitleMusicController() as unknown as TitleMusicController,
      createFakeGameAudioDirector() as unknown as GameAudioDirector,
      { quietGapSeconds: 0.25 },
    );

    coordinator.startLine('coinTossSetup', createSelection('coin_toss_setup_test', 0.4));
    await Promise.resolve();
    coordinator.startLine('coinTossResult', createSelection('coin_toss_result_test', 0.4));

    expect(mixer.playedAssetIds).toEqual(['coin_toss_setup_test']);
    expect(coordinator.getSnapshot()).toMatchObject({
      activeLine: { lineId: 'coinTossSetup' },
      queuedLine: { lineId: 'coinTossResult' },
    });
  });
});

function createSelection(scriptId: string, durationSeconds: number) {
  return {
    assetId: scriptId,
    available: true,
    caption: scriptId,
    clip: {
      assetId: scriptId,
      caption: scriptId,
      category: 'coinTossSetup' as const,
      durationSeconds,
      script: scriptId,
      scriptId,
      variant: 1,
    },
    fallbackReason: null,
    script: scriptId,
    scriptId,
  };
}

function createFakeTitleMusicController() {
  return {
    fadeOutForGameplay: () => undefined,
    getSnapshot: () => ({
      assetId: 'title',
      attempted: false,
      handoffRequested: false,
      loopActive: false,
      loopGain: 0.72,
      state: 'idle',
    }),
    setPregameDucking: () => undefined,
  };
}

function createFakeGameAudioDirector() {
  return {
    processEvents: () => undefined,
  };
}

class FakePregameMixer implements PregameAudioPort {
  readonly playedAssetIds: string[] = [];
  private timeSeconds = 0;

  getCurrentTime(): number {
    return this.timeSeconds;
  }

  getSnapshot(): AudioMixerSnapshot {
    return {
      activeAudioNodeCount: 1,
      activeBuses: ['master', 'announcer'],
      activeLoops: [],
      activeOneShots: 1,
      activeSourceCount: 1,
      announcerEnabled: true,
      busGains: {
        announcer: 1,
        crowd: 1,
        gameplaySfx: 1,
        master: 1,
        music: 1,
        ui: 1,
      },
      captionsEnabled: false,
      contextState: 'running',
      crowdDuckingGain: 1,
      decodedAssetIds: [],
      decodedBufferBytes: 0,
      enabled: true,
      lastUnlockError: null,
      loadedAssetIds: [],
      loadedCompressedBytes: 0,
      longestLoadedClipSeconds: null,
      missingOptionalAssetIds: [],
      muted: false,
      preparedMediaElementSourceCount: 0,
      streamedAssetIds: [],
      userGestureUnlocked: true,
    };
  }

  playOneShot(assetId: string): Promise<boolean> {
    return this.playOneShotTracked(assetId).then((handle) => Boolean(handle));
  }

  playOneShotTracked(assetId: string): Promise<AudioPlaybackHandle | null> {
    this.playedAssetIds.push(assetId);
    return Promise.resolve(new FakePlaybackHandle(assetId, this.timeSeconds));
  }

  setCrowdDuckingGain(): void {
    return undefined;
  }

  setSettings() {
    return {} as never;
  }

  stopOneShotsByCategory(): number {
    return 0;
  }
}

class FakePlaybackHandle implements AudioPlaybackHandle {
  readonly category = 'announcer' as const;
  readonly ended: Promise<AudioPlaybackCompletion> = new Promise(() => undefined);

  constructor(
    readonly assetId: string,
    readonly startedAt: number,
  ) {}

  stop(): void {
    return undefined;
  }
}
