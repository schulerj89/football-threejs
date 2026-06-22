import { PLAYABLE_FIELD_BOUNDS } from '../field';
import { KeyboardMovementInput, KeyboardPlayControls } from '../input';
import {
  createFormationPreviewModel,
  resolveFormationPreviewMode,
  setFormationPreviewSnapLane,
  snapshotFormationPreviewAsGameplay,
  toggleFormationPreviewPreferredSide,
  type FormationPreviewModel,
} from '../formationPreview';
import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import {
  attemptPass,
  createGameplayModel,
  cycleSelectedReceiver,
  resetPlay,
  restartScoreAttack,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
  type GameplayModel,
  type GameplaySnapshot,
} from '../playState';
import { createPresentationAuditGameplaySnapshot, resolvePresentationAuditState, type PresentationAuditState } from '../presentationAudit';
import { updatePlayerSimulation } from '../playerSimulation';
import type { PlayerModel } from '../playerModel';
import type { FramePerformanceProfiler } from '../performance/FramePerformanceProfiler';

export interface GameplayRuntimeOptions {
  canPunt?: (snapshot: GameplaySnapshot) => boolean;
  canStartPlay?: (snapshot: GameplaySnapshot) => boolean;
  consumeSelectedPlayId: () => string | null;
  gameMode?: GameExperienceSettings['gameMode'];
  onPunt?: (gameplay: GameplayModel, snapshot: GameplaySnapshot) => boolean;
  playbookId: GameExperienceSettings['playbookId'];
  searchParams: URLSearchParams;
  shouldHoldDeadPlayReset: () => boolean;
  skipPresentation: () => void;
}

export class GameplayRuntime {
  readonly formationPreviewModel: FormationPreviewModel | null;
  private readonly keyboardInput = new KeyboardMovementInput(window);
  private readonly searchParams: URLSearchParams;
  private gameMode: GameExperienceSettings['gameMode'];
  private playControls: KeyboardPlayControls;
  private presentationAuditState: PresentationAuditState;

  gameplayModel: GameplayModel;

  constructor(private readonly options: GameplayRuntimeOptions) {
    this.searchParams = options.searchParams;
    this.gameMode = options.gameMode ?? 'scoreAttack';
    this.presentationAuditState = resolvePresentationAuditState(
      options.searchParams.get('presentationState'),
    );
    this.gameplayModel = createGameplayModel({
      challengeMode: options.gameMode === 'exhibition' ? 'exhibition' : 'scoreAttack',
      playbookId: options.playbookId,
    });
    const formationPreviewMode = resolveFormationPreviewMode(
      options.searchParams.get('formationPreview'),
    );
    this.formationPreviewModel = formationPreviewMode
      ? createFormationPreviewModel(formationPreviewMode)
      : null;
    this.playControls = this.createPlayControls();
  }

  get auditState(): PresentationAuditState {
    return this.presentationAuditState;
  }

  get availablePlays() {
    return this.gameplayModel.availablePlays;
  }

  dispose(): void {
    this.playControls.dispose();
  }

  update(delta: number, active: boolean, profiler?: FramePerformanceProfiler): void {
    if (this.formationPreviewModel) {
      for (const player of this.formationPreviewModel.players) {
        player.velocity.x = 0;
        player.velocity.z = 0;
        player.currentState = 'idle';
      }
      return;
    }

    if (!active) {
      this.playControls.consumeRequests();
      this.gameplayModel.player.velocity.x = 0;
      this.gameplayModel.player.velocity.z = 0;
      return;
    }

    if (profiler?.enabled) {
      profiler.measure('input', () => this.updatePlayControls(profiler));
    } else {
      this.updatePlayControls();
    }
    if (
      this.gameplayModel.playState === 'live' &&
      this.gameplayModel.player.currentState === 'userControlled'
    ) {
      const movement = this.keyboardInput.getMovement();
      if (profiler?.enabled) {
        profiler.measure('playerMovementIntegration', () => {
          updatePlayerSimulation(
            this.gameplayModel.player,
            movement,
            delta,
            PLAYABLE_FIELD_BOUNDS,
            { clampSidelines: false },
          );
        });
      } else {
        updatePlayerSimulation(
          this.gameplayModel.player,
          movement,
          delta,
          PLAYABLE_FIELD_BOUNDS,
          { clampSidelines: false },
        );
      }
    } else {
      this.gameplayModel.player.velocity.x = 0;
      this.gameplayModel.player.velocity.z = 0;
    }
    const updateOptions = {
      profiler,
      suppressDeadPlayReset: this.options.shouldHoldDeadPlayReset(),
    };
    if (profiler?.enabled) {
      profiler.measure('gameplayStateUpdate', () => {
        updateGameplayModel(this.gameplayModel, delta, updateOptions);
      });
    } else {
      updateGameplayModel(this.gameplayModel, delta, updateOptions);
    }
  }

  rebuildForPlaybook(
    nextPlaybookId: GameExperienceSettings['playbookId'],
    force = false,
    gameMode: GameExperienceSettings['gameMode'] = this.gameMode,
  ): boolean {
    const nextChallengeMode = gameMode === 'exhibition' ? 'exhibition' : 'scoreAttack';
    if (
      !force &&
      this.gameplayModel.playbookId === nextPlaybookId &&
      this.gameplayModel.challengeMode === nextChallengeMode
    ) {
      return false;
    }

    this.gameMode = gameMode;
    this.gameplayModel = createGameplayModel({
      challengeMode: nextChallengeMode,
      playbookId: nextPlaybookId,
    });
    this.playControls.dispose();
    this.playControls = this.createPlayControls();
    return true;
  }

  getActivePlayers(crowdPreviewEnabled: boolean): PlayerModel[] {
    if (crowdPreviewEnabled) {
      return [];
    }
    return this.formationPreviewModel?.players ?? this.gameplayModel.players;
  }

  getActivePrimaryPlayer(): PlayerModel {
    return this.formationPreviewModel
      ? this.formationPreviewModel.players.find((player) => player.id === 'offense-qb') ??
          this.formationPreviewModel.players[0]
      : this.gameplayModel.player;
  }

  getActiveGameplaySnapshot(crowdPreviewEnabled: boolean): GameplaySnapshot {
    const snapshot = this.formationPreviewModel
      ? snapshotFormationPreviewAsGameplay(this.formationPreviewModel)
      : snapshotGameplayModel(this.gameplayModel);
    if (crowdPreviewEnabled) {
      return { ...snapshot, players: [] };
    }
    return snapshot;
  }

  getActivePresentationSnapshot(crowdPreviewEnabled: boolean): GameplaySnapshot {
    const snapshot = this.getActiveGameplaySnapshot(crowdPreviewEnabled);
    if (!this.searchParams.has('presentationAudit') || !this.formationPreviewModel) {
      return snapshot;
    }
    return createPresentationAuditGameplaySnapshot(snapshot, this.presentationAuditState);
  }

  startFromTitle(
    playbookId: GameExperienceSettings['playbookId'],
    gameMode: GameExperienceSettings['gameMode'],
  ): void {
    this.rebuildForPlaybook(playbookId, true, gameMode);
  }

  discardPendingPlayControls(): void {
    this.playControls.consumeRequests();
  }

  handleFormationPreviewLaneControls(event: KeyboardEvent, resetCamera: () => void): void {
    if (!this.formationPreviewModel || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === '1') {
      setFormationPreviewSnapLane(this.formationPreviewModel, 'leftHash');
      resetCamera();
      event.preventDefault();
      return;
    }
    if (event.key === '2') {
      setFormationPreviewSnapLane(this.formationPreviewModel, 'middle');
      resetCamera();
      event.preventDefault();
      return;
    }
    if (event.key === '3') {
      setFormationPreviewSnapLane(this.formationPreviewModel, 'rightHash');
      resetCamera();
      event.preventDefault();
      return;
    }
    if (event.key === '4' && this.formationPreviewModel.mode === '11v11') {
      toggleFormationPreviewPreferredSide(this.formationPreviewModel);
      resetCamera();
      event.preventDefault();
    }
  }

  handlePresentationAuditControls(event: KeyboardEvent, resetCamera: () => void): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key.toLowerCase() === 'l') {
      this.presentationAuditState = 'locomotionPreview';
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === 'p') {
      this.presentationAuditState = 'preSnap';
      resetCamera();
      event.preventDefault();
    }
  }

  private updatePlayControls(profiler?: FramePerformanceProfiler): void {
    const requests = this.playControls.consumeRequests();
    if (requests.startPlay || requests.resetPlay || requests.restartChallenge) {
      this.options.skipPresentation();
    }
    const snapshot = snapshotGameplayModel(this.gameplayModel);

    if (requests.restartChallenge) {
      restartScoreAttack(this.gameplayModel);
      return;
    }
    if (requests.punt && this.options.canPunt?.(snapshot)) {
      this.options.onPunt?.(this.gameplayModel, snapshot);
      return;
    }
    if (requests.resetPlay) {
      resetPlay(this.gameplayModel);
      return;
    }

    const selectedPlayId = requests.selectedPlayId ?? this.options.consumeSelectedPlayId();
    if (selectedPlayId) {
      selectPlay(this.gameplayModel, selectedPlayId);
    }
    if (requests.cycleReceiver) {
      cycleSelectedReceiver(this.gameplayModel);
    }
    if (requests.pass) {
      if (profiler?.enabled) {
        profiler.measure('passTargetingAndBallSimulation', () => {
          attemptPass(this.gameplayModel);
        });
      } else {
        attemptPass(this.gameplayModel);
      }
    }
    if (requests.startPlay && (this.options.canStartPlay?.(snapshot) ?? true)) {
      startPlay(this.gameplayModel);
    }
  }

  private createPlayControls(): KeyboardPlayControls {
    return new KeyboardPlayControls(
      window,
      this.gameplayModel.availablePlays.map((play) => play.id),
    );
  }
}
