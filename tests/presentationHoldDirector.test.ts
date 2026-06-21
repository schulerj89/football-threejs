import { describe, expect, it } from 'vitest';
import type { BroadcastCommentarySnapshot } from '../src/audio/BroadcastCommentaryDirector';
import type { GameplayCameraDebugSnapshot } from '../src/camera/GameplayCameraController';
import type { PresentationAudioEvent } from '../src/audio/PresentationEventBridge';
import { PresentationHoldDirector } from '../src/presentation/PresentationHoldDirector';

describe('presentation hold director', () => {
  it('does not alter reset timing when cinematics are off', () => {
    const director = new PresentationHoldDirector('off');

    director.update([makeEvent('firstDown', 1)], 0.016);

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
    expect(director.getSnapshot().history[0]).toMatchObject({
      reason: 'cinematicsOff',
      status: 'suppressed',
    });
  });

  it('does not add first-down holds for brief cinematics', () => {
    const director = new PresentationHoldDirector('brief');

    director.update([makeEvent('firstDown', 2)], 0.016);

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
    expect(director.getSnapshot().history[0]).toMatchObject({
      reason: 'notFullCinematics',
      status: 'suppressed',
    });
  });

  it('starts and expires a bounded first-down hold for full cinematics', () => {
    const director = new PresentationHoldDirector('full');

    director.update([makeEvent('firstDown', 3)], 0.016);

    expect(director.shouldHoldDeadPlayReset()).toBe(true);
    expect(director.getSnapshot()).toMatchObject({
      active: true,
      reason: 'firstDown',
    });
    expect(director.getSnapshot().remainingSeconds).toBeLessThanOrEqual(1.25);

    director.update([], 1.3);

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
  });

  it('uses touchdown priority and a longer bounded hold', () => {
    const director = new PresentationHoldDirector('full');

    director.update([makeEvent('firstDown', 4), makeEvent('touchdown', 4)], 0.016);

    expect(director.getSnapshot()).toMatchObject({
      active: true,
      reason: 'touchdown',
    });
    expect(director.getSnapshot().remainingSeconds).toBeLessThanOrEqual(5.5);
  });

  it('deduplicates stable event IDs and skip releases the hold', () => {
    const director = new PresentationHoldDirector('full');
    const event = makeEvent('touchdown', 5);

    director.update([event], 0.016);
    director.update([event], 0.016);

    expect(director.getSnapshot().duplicateSuppressionCount).toBe(1);
    expect(director.skip()).toBe(true);
    expect(director.shouldHoldDeadPlayReset()).toBe(false);
    expect(director.getSnapshot().skippedCount).toBe(1);
  });

  it('allows a two-second touchdown line to complete before reset', () => {
    const director = new PresentationHoldDirector('brief');
    const event = makeEvent('touchdown', 6);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 2 }),
    });
    director.update([], 2, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });
    director.update([], 0.39, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(true);
    expect(director.getSnapshot().touchdown?.blockedReason).toBe('minimumTime');

    director.update([], 2.11, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
    expect(director.getSnapshot().touchdown).toMatchObject({
      commentaryComplete: true,
      releaseReason: 'complete',
    });
  });

  it('allows a seven-second touchdown line to complete before reset', () => {
    const director = new PresentationHoldDirector('brief');
    const event = makeEvent('touchdown', 7);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 7 }),
    });
    director.update([], 4.6, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 2.4 }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(true);
    expect(director.getSnapshot().touchdown?.blockedReason).toBe('commentary');

    director.update([], 2.4, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });
    director.update([], 0.39, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(true);

    director.update([], 0.02, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
  });

  it('releases through fallback behavior when touchdown commentary fails', () => {
    const director = new PresentationHoldDirector('brief');
    const event = makeEvent('touchdown', 8);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { failed: true }),
    });
    director.update([], 4.5, {
      commentary: makeCommentarySnapshot(event.id, { failed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
    expect(director.getSnapshot().touchdown).toMatchObject({
      commentaryUnavailable: true,
      releaseReason: 'complete',
    });
  });

  it('does not wait unnecessarily when the announcer is disabled', () => {
    const director = new PresentationHoldDirector('brief');
    const event = makeEvent('touchdown', 9);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { enabled: false }),
    });
    director.update([], 4.5, {
      commentary: makeCommentarySnapshot(event.id, { enabled: false }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
  });

  it('keeps a cinematics-off touchdown framed until commentary completion', () => {
    const director = new PresentationHoldDirector('off');
    const event = makeEvent('touchdown', 10);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 2 }),
    });
    director.update([], 2, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(true);
    expect(director.getSnapshot().touchdown?.blockedReason).toBe('minimumTime');

    director.update([], 2.9, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
  });

  it('does not release from camera completion alone', () => {
    const director = new PresentationHoldDirector('full');
    const event = makeEvent('touchdown', 11);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 7 }),
    });
    director.updateCameraState(makeCameraSnapshot(null));
    director.update([], 5.5, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 1.5 }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(true);
    expect(director.getSnapshot().touchdown?.blockedReason).toBe('commentary');
  });

  it('does not release from commentary completion before the visual minimum', () => {
    const director = new PresentationHoldDirector('brief');
    const event = makeEvent('touchdown', 12);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });
    director.update([], 3, {
      commentary: makeCommentarySnapshot(event.id, { completed: true }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(true);
    expect(director.getSnapshot().touchdown?.blockedReason).toBe('minimumTime');
  });

  it('prevents indefinite touchdown holds with the safety maximum', () => {
    const director = new PresentationHoldDirector('full');
    const event = makeEvent('touchdown', 13);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 99 }),
    });
    director.updateCameraState(makeCameraSnapshot('touchdownOrbit360'));
    director.update([], 10.01, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 89 }),
    });

    expect(director.shouldHoldDeadPlayReset()).toBe(false);
    expect(director.getSnapshot().touchdown).toMatchObject({
      maximumTimeReached: true,
      releaseReason: 'maximumTimeReached',
    });
  });

  it('skipping the camera shot does not cut off commentary-driven holding', () => {
    const director = new PresentationHoldDirector('full');
    const event = makeEvent('touchdown', 14);

    director.update([event], 0, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 7 }),
    });
    director.updateCameraState(makeCameraSnapshot('touchdownOrbit360'));
    expect(director.getSnapshot().touchdown?.cameraComplete).toBe(false);

    director.updateCameraState(makeCameraSnapshot(null));
    director.update([], 5.5, {
      commentary: makeCommentarySnapshot(event.id, { activeRemainingSeconds: 1.5 }),
    });

    expect(director.getSnapshot().touchdown).toMatchObject({
      cameraComplete: true,
      commentaryComplete: false,
    });
    expect(director.shouldHoldDeadPlayReset()).toBe(true);
  });
});

function makeEvent(type: PresentationAudioEvent['type'], id: number): PresentationAudioEvent {
  return {
    id: `${type}:${id}`,
    playResult: {
      endingBallSpot: { x: 0, z: 10 },
      id,
      reason: type === 'touchdown' ? 'touchdown' : 'tackle',
      scoringTeam: type === 'touchdown' ? 'offense' : null,
      startingBallSpot: { x: 0, z: -15 },
      type: type === 'touchdown' ? 'touchdown' : 'tackle',
      yardsGained: 25,
    },
    playState: 'dead',
    score: type === 'touchdown' ? 6 : 0,
    type,
  };
}

function makeCommentarySnapshot(
  eventId: string,
  options: {
    activeRemainingSeconds?: number;
    completed?: boolean;
    enabled?: boolean;
    failed?: boolean;
  } = {},
): BroadcastCommentarySnapshot {
  const enabled = options.enabled ?? true;
  const assetId = `ann_touchdown_${eventId}`;
  const currentClip = options.activeRemainingSeconds === undefined
    ? null
    : {
      assetId,
      caption: 'Touchdown.',
      category: 'touchdown' as const,
      endsAtSeconds: options.activeRemainingSeconds,
      eventId,
      eventType: 'touchdown' as const,
      priority: 100,
      startedAtSeconds: 0,
    };

  return {
    captionsEnabled: true,
    crowdDuckState: { ducked: !!currentClip, duckingGain: currentClip ? 0.42 : 1 },
    currentCaption: currentClip ? currentClip.caption : null,
    currentClip,
    enabled,
    eventHistory: options.failed
      ? [{
        assetId,
        category: 'touchdown',
        eventId,
        eventType: 'touchdown',
        priority: 100,
        reason: 'missingAsset',
        status: 'suppressed',
        triggerTimeSeconds: 0,
      }]
      : currentClip || options.completed
        ? [{
          assetId,
          category: 'touchdown',
          eventId,
          eventType: 'touchdown',
          priority: 100,
          reason: null,
          status: currentClip ? 'started' : 'played',
          triggerTimeSeconds: 0,
        }]
        : [],
    lastEventSource: eventId,
    lastPriority: 100,
    playback: {
      activeClipId: currentClip?.assetId ?? null,
      completed: options.completed ?? false,
      completedEventIds: options.completed ? [eventId] : [],
      elapsedDuration: currentClip ? 0 : 0,
      eventId: currentClip ? eventId : options.completed || options.failed ? eventId : null,
      expectedDuration: currentClip ? options.activeRemainingSeconds ?? 0 : 0,
      failed: options.failed ?? false,
      failedEventIds: options.failed ? [eventId] : [],
      playing: !!currentClip,
      remainingDuration: options.activeRemainingSeconds ?? 0,
    },
    queue: [],
    remainingCooldowns: [],
  };
}

function makeCameraSnapshot(
  activeShotName: GameplayCameraDebugSnapshot['activeShotName'],
): GameplayCameraDebugSnapshot {
  return {
    activeShotName,
    cameraPosition: { x: 0, y: 10, z: -20 },
    focusPosition: { x: 0, y: 0, z: 50 },
    mode: 'cinematicBroadcast',
    stability: {
      activeShot: activeShotName ?? null,
      cameraPosition: { x: 0, y: 10, z: -20 },
      desiredCameraPosition: { x: 0, y: 10, z: -20 },
      desiredLookTarget: { x: 0, y: 0, z: 50 },
      lookTarget: { x: 0, y: 0, z: 50 },
      perFrameAngularChange: 0,
      perFrameDisplacement: 0,
      preSnapSequenceId: 1,
      reasonCameraTargetChanged: 'stable',
      selectedPlayId: 'inside-zone-11',
    },
    state: 'cinematicBroadcast',
    targetPosition: { x: 0, y: 0, z: 50 },
  };
}
