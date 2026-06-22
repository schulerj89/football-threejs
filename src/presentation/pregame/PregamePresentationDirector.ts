import type { PresentationCameraShot } from '../../camera/PresentationShotDefinitions';
import type { TeamUniformTheme } from '../../teams/TeamThemeApplier';
import type { PregameAudioCoordinator } from './PregameAudioCoordinator';
import {
  createPregameCameraShot,
  createPregameSequence,
  resolvePregameSubjectBounds,
} from './PregameShotDefinitions';
import {
  createHiddenLowerThirdState,
  type PregameLowerThird,
} from './PregameLowerThird';
import type {
  PregameCommentaryLineId,
  PregameCommentarySelections,
  PregameLowerThirdState,
  PregamePresentationContext,
  PregamePresentationPhase,
  PregamePresentationSnapshot,
  PregameSequenceStep,
  PregameShotId,
  PregameSubjectBounds,
} from './PregamePresentationTypes';

export interface PregamePresentationUpdateResult {
  completed: boolean;
  shot: PresentationCameraShot | null;
}

const PREGAME_DIRECTOR_CONFIG = {
  maxDeltaSeconds: 1 / 10,
  titleMusicGameplayFadeSeconds: 1.35,
} as const;

export class PregamePresentationDirector {
  private completed = false;
  private currentStepIndex = 0;
  private elapsedSeconds = 0;
  private phase: PregamePresentationPhase = 'idle';
  private readonly sequence: PregameSequenceStep[];
  private selections: PregameCommentarySelections | null = null;
  private shotElapsedSeconds = 0;
  private startedLineIds = new Set<PregameCommentaryLineId>();
  private subjectBounds: PregameSubjectBounds | null = null;
  private targetGameplayCamera: PregamePresentationContext['targetGameplayCamera'] = 'offensePerspective';
  private transitionFadeStarted = false;
  private weatherCondition: PregamePresentationContext['weatherCondition'] = 'clear';

  constructor(
    private readonly options: {
      audioCoordinator: PregameAudioCoordinator;
      lowerThird: PregameLowerThird;
      settings: {
        cinematics: 'brief' | 'full' | 'off';
      };
    },
  ) {
    this.sequence = createPregameSequence(options.settings.cinematics);
  }

  start(context: PregamePresentationContext): boolean {
    this.reset();
    this.selections = this.options.audioCoordinator.createSelections({
      matchSnapshot: context.matchSnapshot,
      weatherCondition: context.weatherCondition,
    });
    this.targetGameplayCamera = context.targetGameplayCamera;
    this.weatherCondition = context.weatherCondition;

    if (this.sequence.length === 0) {
      this.complete();
      return false;
    }

    this.phase = 'running';
    this.subjectBounds = resolvePregameSubjectBounds(this.sequence[0].shotId, context);
    this.options.lowerThird.hide();
    return true;
  }

  update(deltaSeconds: number, context: PregamePresentationContext): PregamePresentationUpdateResult {
    if (this.phase !== 'running') {
      return {
        completed: this.completed,
        shot: null,
      };
    }

    const delta = clamp(deltaSeconds, 0, PREGAME_DIRECTOR_CONFIG.maxDeltaSeconds);
    const step = this.sequence[this.currentStepIndex];

    if (!step) {
      this.complete();
      return {
        completed: true,
        shot: null,
      };
    }

    this.elapsedSeconds += delta;
    this.shotElapsedSeconds += delta;
    this.options.audioCoordinator.updateAmbience(context.gameplaySnapshot, delta);
    this.syncStepStart(step, context);

    const progress = step.minimumSeconds <= 0
      ? 1
      : clamp(this.shotElapsedSeconds / step.minimumSeconds, 0, 1);
    const shot = createPregameCameraShot(step, context, progress);
    this.subjectBounds = resolvePregameSubjectBounds(step.shotId, context);

    if (this.canAdvanceStep(step)) {
      this.advanceStep(context);
    }

    return {
      completed: this.completed,
      shot: this.completed ? null : shot,
    };
  }

  skip(): PregamePresentationSnapshot {
    if (this.phase !== 'running') {
      return this.getSnapshot();
    }

    this.phase = 'skipped';
    this.completed = true;
    this.options.audioCoordinator.skip();
    this.options.lowerThird.hide();
    return this.getSnapshot();
  }

  complete(): PregamePresentationSnapshot {
    this.phase = 'completed';
    this.completed = true;
    this.options.audioCoordinator.fadeTitleMusicToGameplay(
      PREGAME_DIRECTOR_CONFIG.titleMusicGameplayFadeSeconds,
    );
    this.options.lowerThird.hide();
    return this.getSnapshot();
  }

  reset(): void {
    this.completed = false;
    this.currentStepIndex = 0;
    this.elapsedSeconds = 0;
    this.phase = 'idle';
    this.selections = null;
    this.shotElapsedSeconds = 0;
    this.startedLineIds = new Set();
    this.subjectBounds = null;
    this.targetGameplayCamera = 'offensePerspective';
    this.transitionFadeStarted = false;
    this.weatherCondition = 'clear';
    this.options.audioCoordinator.reset();
    this.options.lowerThird.hide();
  }

  getSnapshot(): PregamePresentationSnapshot {
    const step = this.sequence[this.currentStepIndex] ?? null;
    const audioSnapshot = this.options.audioCoordinator.getSnapshot();
    const minimumSeconds = step?.minimumSeconds ?? 0;
    return {
      activeCommentary: audioSnapshot.activeLine?.lineId ?? null,
      completed: this.completed,
      currentShot: step?.shotId ?? null,
      elapsedSeconds: this.elapsedSeconds,
      holdReason: step?.waitForCommentaryLineId
        ? `commentary:${step.waitForCommentaryLineId}`
        : null,
      lowerThird: this.options.lowerThird.getSnapshot(),
      musicGain: audioSnapshot.musicGain,
      phase: this.phase,
      progress: minimumSeconds > 0
        ? clamp(this.shotElapsedSeconds / minimumSeconds, 0, 1)
        : this.completed ? 1 : 0,
      sequence: this.sequence.map((sequenceStep) => sequenceStep.shotId),
      shotElapsedSeconds: this.shotElapsedSeconds,
      skipState: this.phase === 'running'
        ? 'available'
        : this.phase === 'skipped'
          ? 'skipped'
          : this.phase === 'completed'
            ? 'completed'
            : 'idle',
      subjectBounds: this.subjectBounds,
      targetGameplayCamera: this.targetGameplayCamera,
      weatherCondition: this.weatherCondition,
    };
  }

  private syncStepStart(step: PregameSequenceStep, context: PregamePresentationContext): void {
    if (step.commentaryLineId && this.selections && !this.startedLineIds.has(step.commentaryLineId)) {
      this.startedLineIds.add(step.commentaryLineId);
      this.options.audioCoordinator.startLine(
        step.commentaryLineId,
        this.selections[step.commentaryLineId],
      );
    }

    if (step.shotId === 'transitionToGameplay' && !this.transitionFadeStarted) {
      this.transitionFadeStarted = true;
      this.options.audioCoordinator.fadeTitleMusicToGameplay(
        PREGAME_DIRECTOR_CONFIG.titleMusicGameplayFadeSeconds,
      );
    }

    this.options.lowerThird.sync(resolveLowerThirdState(step, context, this.selections));
  }

  private canAdvanceStep(step: PregameSequenceStep): boolean {
    if (this.shotElapsedSeconds < step.minimumSeconds) {
      return false;
    }

    if (!step.waitForCommentaryLineId) {
      return true;
    }

    return this.options.audioCoordinator.isLineComplete(step.waitForCommentaryLineId);
  }

  private advanceStep(context: PregamePresentationContext): void {
    this.currentStepIndex += 1;
    this.shotElapsedSeconds = 0;

    const nextStep = this.sequence[this.currentStepIndex];
    if (!nextStep) {
      this.complete();
      return;
    }

    this.subjectBounds = resolvePregameSubjectBounds(nextStep.shotId, context);
  }
}

function resolveLowerThirdState(
  step: PregameSequenceStep,
  context: PregamePresentationContext,
  selections: PregameCommentarySelections | null,
): PregameLowerThirdState {
  if (!step.lowerThirdTeamSide || !context.matchSnapshot) {
    return createHiddenLowerThirdState();
  }

  const team = step.lowerThirdTeamSide === 'user'
    ? context.teamTheme.offense
    : context.teamTheme.defense;

  return {
    abbreviation: team.profile.abbreviation,
    accentColor: resolveTeamAccent(team),
    caption: step.commentaryLineId && selections
      ? selections[step.commentaryLineId].caption
      : null,
    displayName: team.profile.displayName,
    visible: true,
  };
}

function resolveTeamAccent(team: TeamUniformTheme): string {
  return team.profile.colors.accent || team.uniform.stripe || team.uniform.jersey;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
