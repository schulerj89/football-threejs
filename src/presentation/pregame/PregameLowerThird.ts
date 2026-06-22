import { getReadableTextColor } from '../../teams/TeamThemeApplier';
import type {
  PregameLowerThirdState,
  PregamePresentationSnapshot,
} from './PregamePresentationTypes';
import type { RenderMetricsSnapshot } from '../../debugOverlay';
import type { GameplayCameraDebugSnapshot } from '../../camera/GameplayCameraController';
import type { CoinTossDebugSnapshot } from '../coinToss/CoinTossTypes';
import type { KickoffFrameSnapshot } from '../../specialTeams/KickoffTypes';

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
  cameraSnapshot: GameplayCameraDebugSnapshot | null = null,
  coinTossSnapshot: CoinTossDebugSnapshot | null = null,
  kickoffSnapshot: KickoffFrameSnapshot | null = null,
): void {
  if (!snapshot) {
    overlay.textContent = 'Pregame: inactive';
    return;
  }

  const bounds = snapshot.subjectBounds;
  overlay.textContent = [
    `phase: ${snapshot.phase}`,
    `shot: ${snapshot.currentShot ?? 'none'}`,
    `nextShot: ${snapshot.nextShot ?? 'none'}`,
    `progress: ${(snapshot.progress * 100).toFixed(0)}%`,
    `elapsed: ${snapshot.elapsedSeconds.toFixed(2)}s`,
    `shotElapsed: ${snapshot.shotElapsedSeconds.toFixed(2)}s`,
    `lastTransition: ${snapshot.lastStepTransitionSeconds?.toFixed(2) ?? 'none'}`,
    `commentary: ${snapshot.activeCommentary ?? 'none'}`,
    `queuedCommentary: ${snapshot.audio.queuedLine?.lineId ?? 'none'}`,
    `playback: ${snapshot.audio.playbackState} ended ${snapshot.audio.activeLine?.actualEndedAtSeconds?.toFixed(2) ?? 'none'} remaining ${snapshot.audio.activeLine?.remainingSeconds.toFixed(2) ?? 'none'}`,
    `activeTeam: ${snapshot.activeTeam ?? 'none'}`,
    `activeSubject: ${snapshot.activeSubject ?? 'none'}`,
    `subjectReady: ${snapshot.subjectReady ? 'yes' : 'no'}`,
    `music: ${snapshot.musicState.state} loop ${snapshot.musicState.loopActive ? 'yes' : 'no'} gain ${snapshot.musicState.gain.toFixed(2)}`,
    `crowd: loops ${snapshot.crowdState.activeLoops.join(',') || 'none'} gain ${snapshot.crowdState.gain.toFixed(2)} duck ${snapshot.crowdState.duckingGain.toFixed(2)}`,
    `sideline: ${snapshot.sidelineCounts.sideline} tunnel ${snapshot.sidelineCounts.tunnel}`,
    `warmup: ${snapshot.warmup.enabled ? 'on' : 'off'} players ${snapshot.warmup.playerCount} props ${snapshot.warmup.propCount} ready ${snapshot.warmup.ready ? 'yes' : 'no'}`,
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
    cameraSnapshot
      ? `camera: displacement ${cameraSnapshot.stability.perFrameDisplacement.toFixed(2)} angular ${cameraSnapshot.stability.perFrameAngularChange.toFixed(3)}`
      : 'camera: unavailable',
    coinTossSnapshot
      ? [
          `coinToss: ${coinTossSnapshot.phase}`,
          `seed: ${coinTossSnapshot.matchSeed ?? 'none'}`,
          `call: ${coinTossSnapshot.userCall ?? coinTossSnapshot.selectedCall}`,
          `face: ${coinTossSnapshot.resolvedFace ?? 'none'}`,
          `winner: ${coinTossSnapshot.winner ?? 'none'}`,
          `opening: ${coinTossSnapshot.openingPossession ?? 'none'}`,
          `secondHalf: ${coinTossSnapshot.secondHalfPossession ?? 'none'}`,
          `coinProgress: ${(coinTossSnapshot.animation.progress * 100).toFixed(0)}%`,
          `coinCommentary: ${coinTossSnapshot.activeCommentary ?? 'none'}`,
          `coinBlockers: ${coinTossSnapshot.completionBlockers.join(',') || 'none'}`,
        ].join('\n')
      : 'coinToss: unavailable',
    kickoffSnapshot
      ? [
          `kickoff: ${kickoffSnapshot.phase}`,
          `kickSeq: ${kickoffSnapshot.sequenceIndex ?? 'none'}`,
          `kicker: ${kickoffSnapshot.kickerRosterId ?? 'none'}`,
          `kickTeams: ${kickoffSnapshot.kickingTeam ?? 'none'} -> ${kickoffSnapshot.receivingTeam ?? 'none'}`,
          `kickLanding: ${kickoffSnapshot.landingType ?? 'none'}`,
          kickoffSnapshot.result
            ? `kickTarget: ${kickoffSnapshot.result.target.x.toFixed(1)},${kickoffSnapshot.result.target.z.toFixed(1)} radius ${kickoffSnapshot.result.uncertaintyRadiusYards.toFixed(1)}`
            : 'kickTarget: none',
          kickoffSnapshot.ballPosition
            ? `kickBall: ${kickoffSnapshot.ballPosition.x.toFixed(1)},${kickoffSnapshot.ballPosition.y.toFixed(1)},${kickoffSnapshot.ballPosition.z.toFixed(1)}`
            : 'kickBall: hidden',
          `kickReticle: ${kickoffSnapshot.reticleVisible ? 'visible' : 'hidden'}`,
          `kickCommentary: ${kickoffSnapshot.activeCommentary ?? 'none'}`,
        ].join('\n')
      : 'kickoff: unavailable',
  ].join('\n');
}
