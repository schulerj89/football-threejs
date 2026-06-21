import { describe, expect, it } from 'vitest';
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
    expect(director.getSnapshot().remainingSeconds).toBeLessThanOrEqual(3);
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
