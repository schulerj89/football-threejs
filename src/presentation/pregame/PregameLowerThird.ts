import { getReadableTextColor } from '../../teams/TeamThemeApplier';
import type {
  PregameLowerThirdState,
  PregamePresentationSnapshot,
} from './PregamePresentationTypes';
import type { RenderMetricsSnapshot } from '../../debugOverlay';

export class PregameLowerThird {
  readonly root: HTMLDivElement;

  private readonly nameElement: HTMLDivElement;
  private readonly abbreviationElement: HTMLDivElement;
  private readonly captionElement: HTMLDivElement;
  private readonly detailElement: HTMLDivElement;
  private state: PregameLowerThirdState = createHiddenLowerThirdState();

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'pregame-lower-third';
    this.root.hidden = true;

    this.abbreviationElement = document.createElement('div');
    this.abbreviationElement.className = 'pregame-lower-third-abbreviation';

    this.nameElement = document.createElement('div');
    this.nameElement.className = 'pregame-lower-third-name';

    this.detailElement = document.createElement('div');
    this.detailElement.className = 'pregame-lower-third-detail';

    this.captionElement = document.createElement('div');
    this.captionElement.className = 'pregame-lower-third-caption';

    this.root.append(
      this.abbreviationElement,
      this.nameElement,
      this.detailElement,
      this.captionElement,
    );
    document.body.append(this.root);
  }

  sync(state: PregameLowerThirdState): void {
    this.state = {
      ...state,
    };
    this.root.hidden = !state.visible;
    this.root.style.setProperty('--pregame-accent', state.accentColor);
    this.root.style.setProperty('--pregame-text', getReadableTextColor(state.accentColor));
    this.abbreviationElement.textContent = state.abbreviation ?? '';
    this.nameElement.textContent = state.displayName ?? '';
    this.detailElement.textContent = state.detail ?? '';
    this.detailElement.hidden = !state.detail;
    this.captionElement.textContent = state.caption ?? '';
  }

  hide(): void {
    this.sync(createHiddenLowerThirdState());
  }

  getSnapshot(): PregameLowerThirdState {
    return { ...this.state };
  }

  dispose(): void {
    this.root.remove();
  }
}

export function createHiddenLowerThirdState(): PregameLowerThirdState {
  return {
    abbreviation: null,
    accentColor: '#f2d94b',
    caption: null,
    detail: null,
    displayName: null,
    visible: false,
  };
}

export function createPregameDebugOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'pregame-debug-overlay';
  return overlay;
}

export function syncPregameDebugOverlay(
  overlay: HTMLDivElement,
  snapshot: PregamePresentationSnapshot | null,
  renderMetrics: RenderMetricsSnapshot | null = null,
): void {
  if (!snapshot) {
    overlay.textContent = 'Pregame: inactive';
    return;
  }

  const bounds = snapshot.subjectBounds;
  overlay.textContent = [
    `phase: ${snapshot.phase}`,
    `shot: ${snapshot.currentShot ?? 'none'}`,
    `progress: ${(snapshot.progress * 100).toFixed(0)}%`,
    `elapsed: ${snapshot.elapsedSeconds.toFixed(2)}s`,
    `shotElapsed: ${snapshot.shotElapsedSeconds.toFixed(2)}s`,
    `commentary: ${snapshot.activeCommentary ?? 'none'}`,
    `activeTeam: ${snapshot.activeTeam ?? 'none'}`,
    `activeSubject: ${snapshot.activeSubject ?? 'none'}`,
    `music: ${snapshot.musicState.state} loop ${snapshot.musicState.loopActive ? 'yes' : 'no'} gain ${snapshot.musicState.gain.toFixed(2)}`,
    `crowd: loops ${snapshot.crowdState.activeLoops.join(',') || 'none'} gain ${snapshot.crowdState.gain.toFixed(2)} duck ${snapshot.crowdState.duckingGain.toFixed(2)}`,
    `sideline: ${snapshot.sidelineCounts.sideline} tunnel ${snapshot.sidelineCounts.tunnel}`,
    `presentationClones: ${snapshot.presentationCloneCount}`,
    `hold: ${snapshot.holdReason ?? 'none'}`,
    `skip: ${snapshot.skipState}`,
    `targetCamera: ${snapshot.targetGameplayCamera}`,
    `weather: ${snapshot.weatherCondition}`,
    bounds
      ? `subject: ${bounds.source} center ${bounds.center.x.toFixed(1)},${bounds.center.z.toFixed(1)} size ${bounds.size.x.toFixed(1)}x${bounds.size.z.toFixed(1)}`
      : 'subject: none',
    snapshot.lowerThird.visible
      ? `lower: ${snapshot.lowerThird.displayName ?? 'none'} ${snapshot.lowerThird.detail ?? ''}`
      : 'lower: hidden',
    snapshot.spotlight.active
      ? [
          `spotlight roster: ${snapshot.spotlight.rosterPlayerId ?? 'none'}`,
          `gameplay: ${snapshot.spotlight.gameplayPlayerId ?? 'none'}`,
          `commentary: ${snapshot.spotlight.selectedCommentaryId ?? 'none'}`,
          `clone: ${snapshot.spotlight.cloneStatus}`,
          `speechRemaining: ${snapshot.spotlight.speechRemainingSeconds?.toFixed(2) ?? 'none'}`,
          `blockers: ${snapshot.spotlight.completionBlockers.join(',') || 'none'}`,
        ].join('\n')
      : 'spotlight: inactive',
    renderMetrics
      ? `frame: ${renderMetrics.frameTimeMs.toFixed(2)}ms calls ${renderMetrics.calls} tris ${renderMetrics.triangles}`
      : 'frame: unavailable',
  ].join('\n');
}
