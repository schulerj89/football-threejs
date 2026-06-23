import { afterEach, describe, expect, it } from 'vitest';
import { createGameplayHud, syncGameplayHud } from '../src/gameplayHud';
import type { GameplaySnapshot } from '../src/playState';

describe('gameplay HUD', () => {
  let restoreDom: (() => void) | null = null;

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it('keeps legacy drive and play labels hidden while preserving scorebug-owned context', () => {
    restoreDom = installGameplayHudDom();

    const hud = createGameplayHud();

    expect(hud.driveStatus.hidden).toBe(true);
    expect(hud.driveStatus.getAttribute('aria-hidden')).toBe('true');
    expect(hud.playCall.hidden).toBe(true);
    expect(hud.playCall.getAttribute('aria-hidden')).toBe('true');

    syncGameplayHud(hud, createGameplaySnapshot());

    expect(hud.driveStatus.textContent).toBe('1st & 10 | Ball -34');
    expect(hud.driveStatus.hidden).toBe(true);
    expect(hud.driveStatus.getAttribute('aria-hidden')).toBe('true');
    expect(hud.playCall.textContent).toBe('Inside Zone 11');
    expect(hud.playCall.hidden).toBe(true);
    expect(hud.playCall.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the safety result message with requested casing', () => {
    restoreDom = installGameplayHudDom();

    const hud = createGameplayHud();
    const snapshot = createGameplaySnapshot();
    snapshot.lastPlayResult = {
      endingBallSpot: { x: 0, z: -51 },
      id: 1,
      reason: 'safety',
      scoringTeam: 'defense',
      startingBallSpot: { x: 0, z: -49 },
      type: 'safety',
      yardsGained: -2,
    };

    syncGameplayHud(hud, snapshot);

    expect(hud.safetyMessage.hidden).toBe(false);
    expect(hud.safetyMessage.textContent).toBe('Safety');
    expect(hud.resultMessage.textContent).toBe('-2 yards');
  });
});

function createGameplaySnapshot(): GameplaySnapshot {
  return {
    drive: {
      currentDown: 1,
      lastDriveResult: null,
      lineOfScrimmage: { x: 0, z: -34 },
      yardsToFirstDown: 10,
    },
    lastPlayResult: null,
    passFeedback: null,
    playState: 'preSnap',
    score: 0,
    scoreAttack: {
      finalScore: null,
      remainingSeconds: 120,
    },
    selectedPlay: {
      displayName: 'Inside Zone 11',
    },
    selectedReceiver: null,
  } as GameplaySnapshot;
}

function installGameplayHudDom(): () => void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const hadDocument = Object.prototype.hasOwnProperty.call(globals, 'document');
  const previousDocument = globals.document;

  globals.document = {
    body: new FakeElement('body'),
    createElement: (tagName: string) => new FakeElement(tagName),
  } as unknown as Document;

  return () => {
    if (hadDocument) {
      globals.document = previousDocument;
    } else {
      delete globals.document;
    }
  };
}

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = {
    setProperty: () => undefined,
  };
  className = '';
  hidden = false;
  textContent = '';

  constructor(readonly tagName: string) {}

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}
