import {
  confirmPlaceKickMeter,
  createPlaceKickMeterState,
  updatePlaceKickMeterState,
  type PlaceKickMeterState,
} from '../specialTeams/PlaceKickMeterModel';
import type { PlaceKickState, PlaceKickTimingInput } from '../specialTeams/PlaceKickTypes';
import type { MatchDifficulty } from '../match/MatchTypes';

export class PlaceKickMeter {
  readonly root: HTMLDivElement;

  private readonly fill: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private state: PlaceKickMeterState | null = null;
  private consumedTiming: PlaceKickTimingInput | null = null;
  private activeSequenceIndex: number | null = null;

  constructor(private readonly target: Window = window) {
    this.root = document.createElement('div');
    this.root.className = 'place-kick-meter';
    this.root.hidden = true;
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Extra point kick meter');

    const label = document.createElement('div');
    label.className = 'place-kick-meter-label';
    label.textContent = 'Extra Point';

    const rail = document.createElement('button');
    rail.className = 'place-kick-meter-rail';
    rail.type = 'button';
    rail.setAttribute('aria-label', 'Stop the kick meter');
    rail.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.confirm();
    });

    const center = document.createElement('div');
    center.className = 'place-kick-meter-center';
    const arrow = document.createElement('div');
    arrow.className = 'place-kick-meter-arrow';
    this.fill = document.createElement('div');
    this.fill.className = 'place-kick-meter-indicator';
    rail.append(center, this.fill, arrow);

    this.status = document.createElement('div');
    this.status.className = 'place-kick-meter-status';
    this.status.textContent = 'Press Space, Enter, or tap to kick.';

    this.root.append(label, rail, this.status);
    document.body.appendChild(this.root);
    this.target.addEventListener('keydown', this.handleKeyDown, { capture: true });
  }

  sync(placeKick: PlaceKickState | null, difficulty: MatchDifficulty, active: boolean): void {
    const sequenceIndex = active ? placeKick?.sequenceIndex ?? null : null;
    const shouldReset =
      sequenceIndex !== this.activeSequenceIndex ||
      !this.state ||
      this.state.confirmed !== Boolean(placeKick?.result);

    if (!active || !placeKick?.kickerRatings) {
      this.root.hidden = true;
      if (!active) {
        this.activeSequenceIndex = null;
        this.state = null;
        this.consumedTiming = null;
      }
      return;
    }

    if (placeKick.result) {
      this.root.hidden = false;
      this.root.dataset.result = placeKick.result.good ? 'good' : 'noGood';
      this.status.textContent = placeKick.result.good
        ? 'GOOD'
        : 'NO GOOD';
      this.fill.style.left = '50%';
      this.state = null;
      this.consumedTiming = null;
      return;
    }

    if (shouldReset) {
      this.activeSequenceIndex = sequenceIndex;
      this.state = createPlaceKickMeterState({
        difficulty,
        ratings: placeKick.kickerRatings,
      });
      this.consumedTiming = null;
      this.root.style.setProperty('--place-kick-target-half', `${this.state.targetHalfWidth * 50}%`);
    }

    this.root.hidden = false;
    delete this.root.dataset.result;
    this.status.textContent = 'Press Space, Enter, or tap to kick.';
    this.render();
  }

  update(deltaSeconds: number): void {
    if (this.root.hidden || !this.state || this.state.confirmed) {
      return;
    }

    this.state = updatePlaceKickMeterState(this.state, deltaSeconds);
    this.render();
  }

  consumeTimingInput(): PlaceKickTimingInput | null {
    const timing = this.consumedTiming;
    this.consumedTiming = null;
    return timing ? { ...timing } : null;
  }

  hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown, { capture: true });
    this.root.remove();
  }

  private confirm(): void {
    if (this.root.hidden || !this.state || this.state.confirmed) {
      return;
    }

    const result = confirmPlaceKickMeter(this.state);
    this.state = result.state;
    this.consumedTiming = result.timingInput;
    this.status.textContent = 'Kick away.';
    this.render();
  }

  private render(): void {
    if (!this.state) {
      return;
    }

    const percentage = ((this.state.normalizedValue + 1) / 2) * 100;
    this.fill.style.left = `${percentage}%`;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.root.hidden || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.code === 'Space' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.confirm();
    }
  };
}
