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
import {
  createPlayerSpotlightLowerThirdState,
} from './PlayerSpotlightLowerThird';
import {
  PlayerSpotlightStage,
} from './PlayerSpotlightStage';
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
import {
  createQuarterbackSpotlightMatchKey,
  resolveQuarterbackSpotlightSubject,
  type QuarterbackSpotlightSubject,
} from './SpotlightSubjectResolver';

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
  private readonly playerSpotlightStage = new PlayerSpotlightStage();
  private phase: PregamePresentationPhase = 'idle';
  private readonly baseSequence: PregameSequenceStep[];
  private sequence: PregameSequenceStep[];
  private selections: PregameCommentarySelections | null = null;
  private shotElapsedSeconds = 0;
  private startedLineIds = new Set<PregameCommentaryLineId>();
  private subjectBounds: PregameSubjectBounds | null = null;
  private quarterbackMatchKey: string | null = null;
  private quarterbackSubject: QuarterbackSpotlightSubject | null = null;
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
    this.baseSequence = createPregameSequence(options.settings.cinematics);
    this.sequence = this.baseSequence;
  }

  start(context: PregamePresentationContext): boolean {
    this.reset();
    this.quarterbackSubject = resolveQuarterbackSpotlightSubject(context);
    this.quarterbackMatchKey = createQuarterbackSpotlightMatchKey(
      context,
      this.quarterbackSubject,
    );
    this.sequence = this.baseSequence.filter((step) =>
      step.shotId !== 'quarterbackSpotlight' ||
      (this.quarterbackMatchKey ? this.playerSpotlightStage.canShow(this.quarterbackMatchKey) : true));
    this.selections = this.options.audioCoordinator.createSelections({
      matchSnapshot: context.matchSnapshot,
      quarterbackRosterPlayerId: this.quarterbackSubject.rosterPlayerId,
      quarterbackTeamId: this.quarterbackSubject.teamId,
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
    this.playerSpotlightStage.clearActive();
    return this.getSnapshot();
  }

  complete(): PregamePresentationSnapshot {
    this.phase = 'completed';
    this.completed = true;
    this.options.audioCoordinator.fadeTitleMusicToGameplay(
      PREGAME_DIRECTOR_CONFIG.titleMusicGameplayFadeSeconds,
    );
    this.options.lowerThird.hide();
    this.playerSpotlightStage.clearActive();
    return this.getSnapshot();
  }

  reset(): void {
    this.completed = false;
    this.currentStepIndex = 0;
    this.elapsedSeconds = 0;
    this.phase = 'idle';
    this.sequence = this.baseSequence;
    this.selections = null;
    this.shotElapsedSeconds = 0;
    this.startedLineIds = new Set();
    this.subjectBounds = null;
    this.quarterbackMatchKey = null;
    this.quarterbackSubject = null;
    this.targetGameplayCamera = 'offensePerspective';
    this.transitionFadeStarted = false;
    this.weatherCondition = 'clear';
    this.options.audioCoordinator.reset();
    this.options.lowerThird.hide();
    this.playerSpotlightStage.clearActive();
  }

  getSnapshot(): PregamePresentationSnapshot {
    const step = this.sequence[this.currentStepIndex] ?? null;
    const audioSnapshot = this.options.audioCoordinator.getSnapshot();
    const minimumSeconds = step?.minimumSeconds ?? 0;
    const spotlightActive = step?.shotId === 'quarterbackSpotlight';
    const activeSpeech = audioSnapshot.activeLine?.lineId === 'quarterback'
      ? audioSnapshot.activeLine
      : null;
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
      spotlight: this.playerSpotlightStage.getSnapshot({
        active: spotlightActive,
        cameraSubjectBounds: this.subjectBounds && spotlightActive
          ? {
              center: { ...this.subjectBounds.center },
              size: { ...this.subjectBounds.size },
            }
          : null,
        completionBlockers: spotlightActive
          ? this.resolveCompletionBlockers(step, audioSnapshot.completedLineIds)
          : [],
        lowerThirdVisible: this.options.lowerThird.getSnapshot().visible,
        speechRemainingSeconds: activeSpeech?.remainingSeconds ?? null,
      }),
      subjectBounds: this.subjectBounds,
      targetGameplayCamera: this.targetGameplayCamera,
      weatherCondition: this.weatherCondition,
    };
  }

  private syncStepStart(step: PregameSequenceStep, context: PregamePresentationContext): void {
    if (
      step.shotId === 'quarterbackSpotlight' &&
      this.quarterbackSubject &&
      this.quarterbackMatchKey
    ) {
      this.playerSpotlightStage.activate(
        this.quarterbackSubject,
        this.selections?.quarterback ?? null,
        this.quarterbackMatchKey,
      );
    }

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

  private resolveCompletionBlockers(
    step: PregameSequenceStep | null,
    completedLineIds: readonly PregameCommentaryLineId[],
  ): string[] {
    if (!step) {
      return [];
    }

    const blockers: string[] = [];
    if (this.shotElapsedSeconds < step.minimumSeconds) {
      blockers.push('minimumDuration');
    }
    if (
      step.waitForCommentaryLineId &&
      !completedLineIds.includes(step.waitForCommentaryLineId)
    ) {
      blockers.push(`commentary:${step.waitForCommentaryLineId}`);
    }
    return blockers;
  }
}

function resolveLowerThirdState(
  step: PregameSequenceStep,
  context: PregamePresentationContext,
  selections: PregameCommentarySelections | null,
): PregameLowerThirdState {
  if (step.shotId === 'quarterbackSpotlight') {
    const subject = resolveQuarterbackSpotlightSubject(context);
    return createPlayerSpotlightLowerThirdState(
      subject,
      selections?.quarterback ?? null,
    );
  }

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
    detail: null,
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
