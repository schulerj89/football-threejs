import { PLAYER_MOVEMENT_BOUNDS } from '../field';
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
  setGameplayRosterBinding,
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
import type { CadenceAudioDirector } from '../audio/CadenceAudioDirector';
import {
  clearPreSnapCadence,
  createPreSnapCadenceState,
  isPreSnapPlaySelectionLocked,
  notifyPreSnapPlaySelected,
  requestPreSnapSnap,
  resetPreSnapCadenceForFormation,
  snapshotPreSnapCadence,
  updatePreSnapCadence,
  type PreSnapCadenceEvents,
  type PreSnapCadenceSnapshot,
} from '../gameplay/PreSnapCadenceModel';
import type { GameplayRosterBinding } from '../roster/GameplayRosterBinding';

export interface GameplayRuntimeOptions {
  canPunt?: (snapshot: GameplaySnapshot) => boolean;
  canStartPlay?: (snapshot: GameplaySnapshot) => boolean;
  consumeSelectedPlayId: () => string | null;
  gameMode?: GameExperienceSettings['gameMode'];
  onPassReleased?: (gameplay: GameplayModel, snapshotBeforeRelease: GameplaySnapshot) => void;
  onPlayStarted?: (gameplay: GameplayModel, snapshotBeforeStart: GameplaySnapshot) => void;
  onPlaySelected?: (playId: string) => void;
  onPunt?: (gameplay: GameplayModel, snapshot: GameplaySnapshot) => boolean;
  playbookId: GameExperienceSettings['playbookId'];
  rosterBinding?: GameplayRosterBinding | null;
  searchParams: URLSearchParams;
  shouldHoldDeadPlayReset: () => boolean;
  skipPresentation: () => void;
}

export class GameplayRuntime {
  readonly formationPreviewModel: FormationPreviewModel | null;
  private readonly keyboardInput = new KeyboardMovementInput(window);
  private readonly searchParams: URLSearchParams;
  private readonly preSnapCadence = createPreSnapCadenceState();
  private cadenceAudioDirector: CadenceAudioDirector | null = null;
  private gameMode: GameExperienceSettings['gameMode'];
  private lastPreSnapCadenceKey: string | null = null;
  private playControls: KeyboardPlayControls;
  private presentationAuditState: PresentationAuditState;
  private rosterBinding: GameplayRosterBinding | null;

  gameplayModel: GameplayModel;

  constructor(private readonly options: GameplayRuntimeOptions) {
    this.searchParams = options.searchParams;
    this.gameMode = options.gameMode ?? 'scoreAttack';
    this.rosterBinding = options.rosterBinding ?? null;
    this.presentationAuditState = resolvePresentationAuditState(
      options.searchParams.get('presentationState'),
    );
    this.gameplayModel = createGameplayModel({
      challengeMode: options.gameMode === 'exhibition' ? 'exhibition' : 'scoreAttack',
      playbookId: options.playbookId,
      rosterBinding: this.rosterBinding,
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
    this.keyboardInput.dispose();
    this.cadenceAudioDirector?.reset();
  }

  setRosterBinding(binding: GameplayRosterBinding | null): void {
    this.rosterBinding = binding;
    setGameplayRosterBinding(this.gameplayModel, binding);
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
      this.suspendPreSnapCadence();
      this.gameplayModel.player.velocity.x = 0;
      this.gameplayModel.player.velocity.z = 0;
      return;
    }

    this.syncPreSnapCadenceForCurrentFormation();
    if (profiler?.enabled) {
      profiler.measure('input', () => this.updatePlayControls(profiler));
    } else {
      this.updatePlayControls();
    }
    this.updatePreSnapCadenceRuntime(delta);
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
            PLAYER_MOVEMENT_BOUNDS,
            { clampSidelines: false },
          );
        });
      } else {
        updatePlayerSimulation(
          this.gameplayModel.player,
          movement,
          delta,
          PLAYER_MOVEMENT_BOUNDS,
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
      rosterBinding: this.rosterBinding,
    });
    this.playControls.dispose();
    this.playControls = this.createPlayControls();
    clearPreSnapCadence(this.preSnapCadence);
    this.lastPreSnapCadenceKey = null;
    this.cadenceAudioDirector?.reset();
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

  setCadenceAudioDirector(cadenceAudioDirector: CadenceAudioDirector): void {
    this.cadenceAudioDirector = cadenceAudioDirector;
  }

  getPreSnapCadenceSnapshot(): PreSnapCadenceSnapshot {
    return snapshotPreSnapCadence(this.preSnapCadence);
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
    const snapshot = snapshotGameplayModel(this.gameplayModel);

    if (requests.restartChallenge) {
      this.options.skipPresentation();
      restartScoreAttack(this.gameplayModel);
      this.resetCadenceForCurrentPreSnap();
      return;
    }
    if (requests.punt && this.options.canPunt?.(snapshot)) {
      this.options.onPunt?.(this.gameplayModel, snapshot);
      return;
    }
    if (requests.resetPlay) {
      this.options.skipPresentation();
      resetPlay(this.gameplayModel);
      this.resetCadenceForCurrentPreSnap();
      return;
    }

    const selectedPlayId = requests.selectedPlayId ?? this.options.consumeSelectedPlayId();
    if (selectedPlayId && !isPreSnapPlaySelectionLocked(this.preSnapCadence)) {
      const selected = selectPlay(this.gameplayModel, selectedPlayId);
      if (selected) {
        this.options.onPlaySelected?.(this.gameplayModel.selectedPlay.id);
        this.cadenceAudioDirector?.reset();
        this.handlePreSnapCadenceEvents(
          notifyPreSnapPlaySelected(this.preSnapCadence, this.gameplayModel.selectedPlay.id),
        );
        this.lastPreSnapCadenceKey = this.createPreSnapCadenceKey();
      }
    }
    if (requests.cycleReceiver) {
      cycleSelectedReceiver(this.gameplayModel);
    }
    if (requests.pass) {
      const snapshotBeforeRelease = snapshotGameplayModel(this.gameplayModel);
      let released = false;
      if (profiler?.enabled) {
        profiler.measure('passTargetingAndBallSimulation', () => {
          released = attemptPass(this.gameplayModel);
        });
      } else {
        released = attemptPass(this.gameplayModel);
      }
      if (released) {
        this.options.onPassReleased?.(this.gameplayModel, snapshotBeforeRelease);
      }
    }
    if (requests.startPlay && (this.options.canStartPlay?.(snapshot) ?? true)) {
      const events = requestPreSnapSnap(this.preSnapCadence);
      this.handlePreSnapCadenceEvents(events);
      if (events.snapAccepted) {
        this.options.skipPresentation();
      }
    }
  }

  private updatePreSnapCadenceRuntime(deltaSeconds: number): void {
    if (this.gameplayModel.playState !== 'preSnap') {
      clearPreSnapCadence(this.preSnapCadence);
      this.lastPreSnapCadenceKey = null;
      return;
    }

    const readyCompleted = this.cadenceAudioDirector?.consumeCompletion(
      'ready',
      this.preSnapCadence.readyAssetId,
    ) ?? false;
    const hutCompleted = this.cadenceAudioDirector?.consumeCompletion(
      'hut',
      this.preSnapCadence.hutAssetId,
    ) ?? false;
    const events = updatePreSnapCadence(this.preSnapCadence, {
      deltaSeconds,
      hutAudioCompleted: hutCompleted,
      readyAudioCompleted: readyCompleted,
    });
    this.handlePreSnapCadenceEvents(events);
    if (events.snapReleased) {
      const snapshot = snapshotGameplayModel(this.gameplayModel);
      if (this.options.canStartPlay?.(snapshot) ?? true) {
        if (startPlay(this.gameplayModel)) {
          this.options.onPlayStarted?.(this.gameplayModel, snapshot);
        }
      }
    }
  }

  private handlePreSnapCadenceEvents(events: PreSnapCadenceEvents): void {
    if (events.readyCueRequested) {
      this.cadenceAudioDirector?.playCue('ready', events.readyCueRequested);
    }
    if (events.hutCueRequested) {
      this.cadenceAudioDirector?.playCue('hut', events.hutCueRequested);
    }
  }

  private syncPreSnapCadenceForCurrentFormation(): void {
    if (this.gameplayModel.playState !== 'preSnap') {
      clearPreSnapCadence(this.preSnapCadence);
      this.lastPreSnapCadenceKey = null;
      return;
    }

    const key = this.createPreSnapCadenceKey();
    if (this.lastPreSnapCadenceKey === key) {
      return;
    }

    this.cadenceAudioDirector?.reset();
    this.handlePreSnapCadenceEvents(
      resetPreSnapCadenceForFormation(this.preSnapCadence, this.gameplayModel.selectedPlay.id),
    );
    this.lastPreSnapCadenceKey = key;
  }

  private resetCadenceForCurrentPreSnap(): void {
    this.lastPreSnapCadenceKey = null;
    this.cadenceAudioDirector?.reset();
    this.syncPreSnapCadenceForCurrentFormation();
  }

  private suspendPreSnapCadence(): void {
    clearPreSnapCadence(this.preSnapCadence);
    this.lastPreSnapCadenceKey = null;
    this.cadenceAudioDirector?.reset();
  }

  private createPreSnapCadenceKey(): string {
    return [
      this.gameplayModel.selectedPlay.id,
      this.gameplayModel.drive.snapLane,
      this.gameplayModel.currentBallSpot.x.toFixed(3),
      this.gameplayModel.currentBallSpot.z.toFixed(3),
    ].join('|');
  }

  private createPlayControls(): KeyboardPlayControls {
    return new KeyboardPlayControls(
      window,
      this.gameplayModel.availablePlays.map((play) => play.id),
    );
  }
}
