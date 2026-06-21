import { describe, expect, it } from 'vitest';
import {
  type AudioPlaybackPort,
  GameAudioDirector,
} from '../src/audio/GameAudioDirector';
import { derivePresentationAudioEvents } from '../src/audio/PresentationEventBridge';
import type { AudioMixerSnapshot } from '../src/audio/AudioMixer';
import type { DriveSnapshot } from '../src/driveModel';
import type { GameplaySnapshot, PlayResult } from '../src/playState';

describe('presentation audio event bridge and director', () => {
  it('emits touchdown once and does not also emit a first-down event', () => {
    const live = makeSnapshot({ playState: 'live' });
    const touchdown = makeSnapshot({
      drive: {
        lastDriveResult: {
          nextDriveStartLane: 'middle',
          nextDriveStartSpot: { x: 0, z: -15 },
          reason: 'touchdown',
          type: 'touchdown',
        },
        state: 'over',
      },
      lastPlayResult: makeResult(1, 'touchdown', 45),
      playState: 'dead',
      score: 6,
    });

    const events = derivePresentationAudioEvents(live, touchdown);

    expect(events.map((event) => event.type)).toEqual(['touchdown']);
    expect(events[0].id).toBe('touchdown:1');
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[0])).toBe(true);
  });

  it('plays exactly one touchdown crowd reaction per touchdown result', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({ playState: 'live' });
    const touchdown = makeSnapshot({
      drive: {
        lastDriveResult: {
          nextDriveStartLane: 'middle',
          nextDriveStartSpot: { x: 0, z: -15 },
          reason: 'touchdown',
          type: 'touchdown',
        },
        state: 'over',
      },
      lastPlayResult: makeResult(1, 'touchdown', 45),
      playState: 'dead',
      score: 6,
    });

    director.update(live, 0.016);
    director.update(touchdown, 0.016);
    director.update(touchdown, 1);
    await director.flushPendingAudioForTests();

    expect(countAssets(mixer.playedOneShots, 'crowd_touchdown')).toBe(1);
    expect(countAssets(mixer.playedOneShots, 'crowd_first_down')).toBe(0);
  });

  it('plays exactly one first-down reaction for a line-to-gain result', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({ playState: 'live' });
    const firstDown = makeSnapshot({
      drive: {
        currentDown: 1,
        firstDownMarker: { x: 0, z: 5.5 },
        lineOfScrimmage: { x: 0, z: -4.5 },
        yardsToFirstDown: 10,
      },
      lastPlayResult: makeResult(7, 'tackle', -4.5),
      playState: 'dead',
    });

    director.update(live, 0.016);
    director.update(firstDown, 0.016);
    director.update(firstDown, 1);
    await director.flushPendingAudioForTests();

    expect(countAssets(mixer.playedOneShots, 'crowd_first_down')).toBe(1);
  });

  it('does not duplicate tackle sounds during the dead-state delay or reset', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({ playState: 'live' });
    const tackle = makeSnapshot({
      drive: {
        currentDown: 2,
        lineOfScrimmage: { x: 0, z: -12 },
        yardsToFirstDown: 7,
      },
      lastPlayResult: makeResult(3, 'tackle', -12),
      playState: 'dead',
    });
    const reset = makeSnapshot({
      drive: {
        currentDown: 2,
        lineOfScrimmage: { x: 0, z: -12 },
        yardsToFirstDown: 7,
      },
      playState: 'preSnap',
    });

    director.update(live, 0.016);
    director.update(tackle, 0.016);
    director.update(tackle, 0.5);
    director.update(reset, 0.5);
    await director.flushPendingAudioForTests();

    expect(countAssets(mixer.playedOneShots, 'pads_hit')).toBe(1);
  });

  it('plays the turnover reaction once when fourth down fails', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({
      drive: {
        currentDown: 4,
        firstDownMarker: { x: 0, z: -5 },
        lineOfScrimmage: { x: 0, z: -15 },
      },
      playState: 'live',
    });
    const turnover = makeSnapshot({
      drive: {
        currentDown: 4,
        lastDriveResult: {
          nextDriveStartLane: 'middle',
          nextDriveStartSpot: { x: 0, z: -15 },
          reason: 'turnoverOnDowns',
          type: 'turnoverOnDowns',
        },
        lineOfScrimmage: { x: 0, z: -12 },
        state: 'over',
      },
      lastPlayResult: makeResult(12, 'outOfBounds', -12),
      playState: 'dead',
    });

    director.update(live, 0.016);
    director.update(turnover, 0.016);
    await director.flushPendingAudioForTests();

    expect(countAssets(mixer.playedOneShots, 'crowd_turnover')).toBe(1);
  });

  it('keeps muted mode silent while preserving suppression history', async () => {
    const mixer = new FakeAudioPlaybackPort();
    mixer.snapshot.muted = true;
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({ playState: 'live' });
    const touchdown = makeSnapshot({
      lastPlayResult: makeResult(5, 'touchdown', 45),
      playState: 'dead',
    });

    director.update(live, 0.016);
    director.update(touchdown, 0.016);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots).toEqual([]);
    expect(director.getSnapshot().eventHistory.some((entry) => entry.reason === 'muted')).toBe(true);
  });

  it('records missing optional reactions without throwing or changing gameplay snapshots', async () => {
    const mixer = new FakeAudioPlaybackPort();
    mixer.playResult = false;
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({ playState: 'live' });
    const incomplete = makeSnapshot({
      lastPlayResult: makeResult(6, 'incomplete', -15),
      playState: 'dead',
    });
    const before = JSON.stringify(incomplete);

    director.update(live, 0.016);
    director.update(incomplete, 0.016);
    await director.flushPendingAudioForTests();

    expect(JSON.stringify(incomplete)).toBe(before);
    expect(director.getSnapshot().eventHistory.some((entry) => entry.reason === 'missingAsset')).toBe(true);
  });

  it('selects variants deterministically while avoiding immediate repetition', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({ playState: 'live' });

    for (const resultId of [20, 21]) {
      const result = makeSnapshot({
        drive: {
          currentDown: 1,
          firstDownMarker: { x: 0, z: 10 + resultId },
          lineOfScrimmage: { x: 0, z: resultId },
          yardsToFirstDown: 10,
        },
        lastPlayResult: makeResult(resultId, 'tackle', resultId),
        playState: 'dead',
      });
      director.update(live, 0.016);
      director.update(result, 0.016);
    }
    await director.flushPendingAudioForTests();

    const firstDownAssets = mixer.playedOneShots.filter((assetId) =>
      assetId.startsWith('crowd_first_down'),
    );
    expect(firstDownAssets).toHaveLength(2);
    expect(firstDownAssets[0]).not.toBe(firstDownAssets[1]);
  });

  it('suppresses events while the page is inactive and does not replay stale results on resume', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);
    const live = makeSnapshot({ playState: 'live' });
    const touchdown = makeSnapshot({
      lastPlayResult: makeResult(30, 'touchdown', 45),
      playState: 'dead',
      score: 6,
    });

    director.update(live, 0.016);
    director.setPageActive(false);
    director.update(touchdown, 0.016);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots).toEqual([]);
    expect(director.getSnapshot().eventHistory.some((entry) => entry.reason === 'pageHidden')).toBe(true);

    director.setPageActive(true);
    director.update(touchdown, 0.016);
    await director.flushPendingAudioForTests();

    expect(mixer.playedOneShots).toEqual([]);
  });

  it('keeps no more than two ambience loops active during live and pre-snap transitions', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);

    director.update(makeSnapshot({ playState: 'preSnap' }), 0.5);
    director.update(makeSnapshot({ playState: 'live' }), 0.5);
    await director.flushPendingAudioForTests();

    expect(mixer.loopGains.size).toBeLessThanOrEqual(2);

    director.update(makeSnapshot({ playState: 'preSnap' }), 0.5);
    await director.flushPendingAudioForTests();

    expect(mixer.loopGains.size).toBeLessThanOrEqual(2);
  });

  it('handles repeated touchdown results as separate stable result identities', async () => {
    const mixer = new FakeAudioPlaybackPort();
    const director = new GameAudioDirector(mixer);

    for (const resultId of [40, 41]) {
      director.update(makeSnapshot({ playState: 'live' }), 0.016);
      director.update(makeSnapshot({
        lastPlayResult: makeResult(resultId, 'touchdown', 45),
        playState: 'dead',
        score: resultId === 40 ? 6 : 12,
      }), 0.016);
    }
    await director.flushPendingAudioForTests();

    expect(countAssets(mixer.playedOneShots, 'crowd_touchdown')).toBe(2);
  });
});

function makeSnapshot(overrides: {
  ballState?: GameplaySnapshot['ball']['state'];
  drive?: Partial<DriveSnapshot>;
  lastPlayResult?: PlayResult | null;
  playState?: GameplaySnapshot['playState'];
  score?: number;
} = {}): GameplaySnapshot {
  const drive: DriveSnapshot = {
    currentDown: 1,
    firstDownMarker: { x: 0, z: -5 },
    lastDriveResult: null,
    lineOfScrimmage: { x: 0, z: -15 },
    snapLane: 'middle',
    state: 'active',
    yardsToFirstDown: 10,
    ...overrides.drive,
  };
  const playState = overrides.playState ?? 'preSnap';

  return {
    activePlayStartSpot: playState === 'live' || playState === 'dead' ? { x: 0, z: -15 } : null,
    ball: {
      possession: playState === 'live' ? { kind: 'player', playerId: 'offense-rb' } : { kind: 'none' },
      position: { x: 0, y: 1, z: drive.lineOfScrimmage.z },
      state: overrides.ballState ?? (playState === 'live'
        ? { kind: 'possessed', playerId: 'offense-rb' }
        : { kind: 'dead' }),
    },
    blocking: { engagements: [] },
    currentBallSpot: { ...drive.lineOfScrimmage },
    drive,
    exactDeadBallSpot: overrides.lastPlayResult?.endingBallSpot ?? null,
    formationOrigin: { ...drive.lineOfScrimmage },
    forwardPassEligible: true,
    lastPlayResult: overrides.lastPlayResult ?? null,
    nextBallSpot: { ...drive.lineOfScrimmage },
    nextSnapSpot: { ...drive.lineOfScrimmage },
    passAttempted: false,
    passAudit: null,
    passFeedback: null,
    player: {
      collisionRadius: 1,
      currentState: playState === 'live' ? 'userControlled' : 'idle',
      facingRadians: 0,
      id: 'offense-rb',
      position: { x: 0, z: drive.lineOfScrimmage.z },
      role: 'runner',
      team: 'offense',
      velocity: { x: 0, z: 0 },
    },
    players: [],
    playbookId: '5v5',
    playState,
    receiverRouteStates: [],
    score: overrides.score ?? 0,
    scoreAttack: {
      durationSeconds: 120,
      finalScore: null,
      remainingSeconds: 100,
      state: playState === 'live' ? 'running' : 'ready',
    },
    selectedPlay: {
      displayName: 'Inside Run',
      id: 'inside-run',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'run',
    },
    selectedReceiver: null,
    snapLane: drive.snapLane,
  };
}

function makeResult(
  id: number,
  type: PlayResult['type'],
  endingZ: number,
): PlayResult {
  return {
    endingBallSpot: { x: 0, z: endingZ },
    id,
    reason: type,
    scoringTeam: type === 'touchdown' ? 'offense' : null,
    startingBallSpot: { x: 0, z: -15 },
    type,
    yardsGained: endingZ + 15,
  };
}

function countAssets(assetIds: readonly string[], prefix: string): number {
  return assetIds.filter((assetId) => assetId.startsWith(prefix)).length;
}

class FakeAudioPlaybackPort implements AudioPlaybackPort {
  readonly loopGains = new Map<string, number>();
  readonly playedOneShots: string[] = [];
  currentTime = 0;
  playResult = true;
  snapshot: AudioMixerSnapshot = {
    activeAudioNodeCount: 5,
    activeBuses: ['master', 'crowd', 'gameplaySfx'],
    activeLoops: [],
    activeOneShots: 0,
    activeSourceCount: 0,
    announcerEnabled: true,
    busGains: {
      announcer: 0.85,
      crowd: 0.45,
      gameplaySfx: 0.85,
      master: 0.85,
      ui: 0.85,
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

  getCurrentTime(): number {
    return this.currentTime;
  }

  getLoopGain(assetId: string): number {
    return this.loopGains.get(assetId) ?? 0;
  }

  getSnapshot(): AudioMixerSnapshot {
    return {
      ...this.snapshot,
      activeSourceCount: this.loopGains.size,
      activeLoops: [...this.loopGains.keys()],
      preparedMediaElementSourceCount: this.loopGains.size,
    };
  }

  hasActiveLoop(assetId: string): boolean {
    return this.loopGains.has(assetId);
  }

  installUserGestureUnlock(): void {}

  async playOneShot(assetId: string): Promise<boolean> {
    if (this.playResult) {
      this.playedOneShots.push(assetId);
    }
    return this.playResult;
  }

  setLoopGain(assetId: string, gain: number): boolean {
    if (!this.loopGains.has(assetId)) {
      return false;
    }

    this.loopGains.set(assetId, gain);
    return true;
  }

  setMuted(muted: boolean): void {
    this.snapshot.muted = muted;
  }

  async startLoop(assetId: string, options: { gain?: number } = {}): Promise<boolean> {
    this.loopGains.set(assetId, options.gain ?? 0);
    return true;
  }

  stopLoop(assetId: string): boolean {
    return this.loopGains.delete(assetId);
  }

  toggleMuted(): void {
    this.snapshot.muted = !this.snapshot.muted;
  }
}
