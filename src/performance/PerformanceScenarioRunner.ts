import { giveBallToPlayer } from '../ballModel';
import { INITIAL_BALL_SPOT, OPPOSING_GOAL_LINE_Z } from '../field';
import { resetDriveModel } from '../driveModel';
import { cloneFootballSpot } from '../fieldScale';
import {
  attemptPass,
  resetPlay,
  selectPlay,
  startPlay,
  updateGameplayModel,
  type GameplayModel,
} from '../playState';
import type { PlayerModel } from '../playerModel';
import type { PerformanceScenarioName } from './PerformanceBudget';

export interface PerformanceScenarioSnapshot {
  activeScenario: PerformanceScenarioName | null;
  elapsedSeconds: number;
  sequence: number;
}

export class PerformanceScenarioRunner {
  private activeScenario: PerformanceScenarioName | null = null;
  private elapsedSeconds = 0;
  private sequence = 0;

  constructor(private readonly getGameplayModel: () => GameplayModel) {}

  getActiveScenarioName(): string {
    return this.activeScenario ?? 'normal-gameplay';
  }

  setScenario(scenario: PerformanceScenarioName): PerformanceScenarioSnapshot {
    this.activeScenario = scenario;
    this.elapsedSeconds = 0;
    this.sequence += 1;
    this.applyScenario(scenario);
    return this.getSnapshot();
  }

  clearScenario(): void {
    this.activeScenario = null;
    this.elapsedSeconds = 0;
  }

  update(deltaSeconds: number): void {
    if (!this.activeScenario) {
      return;
    }

    this.elapsedSeconds += Math.max(0, deltaSeconds);

    if (this.activeScenario === 'eleven-reset-cycle') {
      this.updateResetCycle();
      return;
    }

    if (
      this.activeScenario === 'eleven-pass-flight' &&
      this.elapsedSeconds > 0.8
    ) {
      this.applyScenario('eleven-pass-flight');
      return;
    }

    if (
      this.activeScenario === 'eleven-touchdown-presentation' &&
      this.elapsedSeconds > 2
    ) {
      this.applyScenario('eleven-touchdown-presentation');
    }
  }

  getSnapshot(): PerformanceScenarioSnapshot {
    return {
      activeScenario: this.activeScenario,
      elapsedSeconds: this.elapsedSeconds,
      sequence: this.sequence,
    };
  }

  private applyScenario(scenario: PerformanceScenarioName): void {
    switch (scenario) {
      case 'eleven-presnap':
        this.preparePlay('inside-zone-11', false);
        break;
      case 'eleven-run-interior':
        this.preparePlay('inside-zone-11', true);
        break;
      case 'eleven-run-open-field':
        this.prepareOpenFieldRun();
        break;
      case 'eleven-pass-routes':
        this.preparePlay('spread-quick-11', true);
        break;
      case 'eleven-pass-flight':
        this.preparePassFlight();
        break;
      case 'eleven-after-catch':
        this.prepareAfterCatch();
        break;
      case 'eleven-touchdown-presentation':
        this.prepareTouchdownPresentation();
        break;
      case 'eleven-reset-cycle':
        this.preparePlay('inside-zone-11', false);
        break;
    }
  }

  private preparePlay(playId: string, live: boolean): GameplayModel {
    const gameplay = this.getGameplayModel();
    const initialSpot = cloneFootballSpot(INITIAL_BALL_SPOT);
    gameplay.currentBallSpot = cloneFootballSpot(initialSpot);
    gameplay.nextBallSpot = cloneFootballSpot(initialSpot);
    gameplay.nextSnapSpot = cloneFootballSpot(initialSpot);
    resetDriveModel(gameplay.drive, initialSpot);
    resetPlay(gameplay);
    selectPlay(gameplay, playId);
    if (live) {
      startPlay(gameplay);
    }
    return gameplay;
  }

  private prepareOpenFieldRun(): void {
    const gameplay = this.preparePlay('inside-zone-11', true);
    const carrier = gameplay.player;
    carrier.position.x = 0;
    carrier.position.z = gameplay.drive.lineOfScrimmage.z + 34;
    carrier.velocity.x = 0;
    carrier.velocity.z = 9;
    carrier.currentState = 'userControlled';
    giveBallToPlayer(gameplay.ball, carrier);
    spreadPlayersAroundCarrier(gameplay.players, carrier);
  }

  private preparePassFlight(): void {
    const gameplay = this.preparePlay('spread-quick-11', true);
    gameplay.selectedReceiverId = 'offense-slot';
    attemptPass(gameplay);
    this.elapsedSeconds = 0;
  }

  private prepareAfterCatch(): void {
    const gameplay = this.preparePlay('spread-quick-11', true);
    const receiver = findPlayer(gameplay, 'offense-slot') ?? gameplay.player;
    receiver.position.x = 0;
    receiver.position.z = gameplay.drive.lineOfScrimmage.z + 16;
    receiver.velocity.x = 0;
    receiver.velocity.z = 8;
    receiver.currentState = 'userControlled';
    gameplay.player.currentState = 'idle';
    gameplay.player = receiver;
    giveBallToPlayer(gameplay.ball, receiver, 'caught');
    for (const defender of gameplay.players.filter((player) => player.team === 'defense')) {
      defender.currentState = 'pursuing';
    }
  }

  private prepareTouchdownPresentation(): void {
    const gameplay = this.preparePlay('inside-zone-11', true);
    const carrier = gameplay.player;
    carrier.position.x = 0;
    carrier.position.z = OPPOSING_GOAL_LINE_Z - carrier.collisionRadius * 0.5;
    carrier.velocity.x = 0;
    carrier.velocity.z = 8;
    carrier.currentState = 'userControlled';
    giveBallToPlayer(gameplay.ball, carrier);
    updateGameplayModel(gameplay, 1 / 60);
    this.elapsedSeconds = 0;
  }

  private updateResetCycle(): void {
    if (this.elapsedSeconds < 0.25) {
      return;
    }

    const gameplay = this.getGameplayModel();
    this.elapsedSeconds = 0;
    if (gameplay.playState === 'preSnap') {
      startPlay(gameplay);
    } else {
      resetPlay(gameplay);
    }
  }
}

function spreadPlayersAroundCarrier(players: PlayerModel[], carrier: PlayerModel): void {
  let offsetIndex = 0;

  for (const player of players) {
    if (player.id === carrier.id) {
      continue;
    }

    const side = offsetIndex % 2 === 0 ? -1 : 1;
    const row = Math.floor(offsetIndex / 2) + 1;
    player.position.x = side * (3 + row * 1.2);
    player.position.z = carrier.position.z - 6 - row * 2.2;
    player.velocity.x = 0;
    player.velocity.z = player.team === 'defense' ? 8 : 5;
    player.currentState = player.team === 'defense' ? 'pursuing' : 'movingToLane';
    offsetIndex += 1;
  }
}

function findPlayer(gameplay: GameplayModel, playerId: string): PlayerModel | null {
  return gameplay.players.find((player) => player.id === playerId) ?? null;
}
