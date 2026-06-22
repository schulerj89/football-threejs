import type { PregameCommentarySelection } from '../../audio/PregameCommentaryCatalog';
import type { QuarterbackSpotlightSubject } from './SpotlightSubjectResolver';

export interface PlayerSpotlightStageSnapshot {
  active: boolean;
  cameraSubjectBounds: {
    center: { x: number; y: number; z: number };
    size: { x: number; z: number };
  } | null;
  cloneStatus: 'none' | 'usingWarmupClone';
  completionBlockers: readonly string[];
  gameplayPlayerId: string | null;
  lowerThirdVisible: boolean;
  rosterPlayerId: string | null;
  selectedCommentaryId: string | null;
  speechRemainingSeconds: number | null;
  subjectFallbackReason: string | null;
}

export interface PlayerSpotlightStageSnapshotOptions {
  active: boolean;
  cameraSubjectBounds: PlayerSpotlightStageSnapshot['cameraSubjectBounds'];
  completionBlockers: readonly string[];
  lowerThirdVisible: boolean;
  speechRemainingSeconds: number | null;
}

export class PlayerSpotlightStage {
  private activeSubject: QuarterbackSpotlightSubject | null = null;
  private activeSelection: PregameCommentarySelection | null = null;
  private readonly shownMatchKeys = new Set<string>();

  canShow(matchKey: string): boolean {
    return !this.shownMatchKeys.has(matchKey);
  }

  activate(
    subject: QuarterbackSpotlightSubject,
    selection: PregameCommentarySelection | null,
    matchKey: string,
  ): void {
    if (this.activeSubject?.rosterPlayerId === subject.rosterPlayerId) {
      return;
    }

    this.activeSubject = subject;
    this.activeSelection = selection;
    this.shownMatchKeys.add(matchKey);
  }

  clearActive(): void {
    this.activeSubject = null;
    this.activeSelection = null;
  }

  resetPresentationIdentity(): void {
    this.clearActive();
    this.shownMatchKeys.clear();
  }

  getSnapshot(options: PlayerSpotlightStageSnapshotOptions): PlayerSpotlightStageSnapshot {
    return {
      active: options.active,
      cameraSubjectBounds: options.cameraSubjectBounds,
      cloneStatus: this.activeSubject ? 'usingWarmupClone' : 'none',
      completionBlockers: [...options.completionBlockers],
      gameplayPlayerId: this.activeSubject?.gameplayPlayerId ?? null,
      lowerThirdVisible: options.lowerThirdVisible,
      rosterPlayerId: this.activeSubject?.rosterPlayerId ?? null,
      selectedCommentaryId: this.activeSelection?.scriptId ?? null,
      speechRemainingSeconds: options.speechRemainingSeconds,
      subjectFallbackReason: this.activeSubject?.fallbackReason ?? null,
    };
  }
}
