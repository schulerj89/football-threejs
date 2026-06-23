import type { GameplaySnapshot } from './playState';
import type { PreSnapCadenceSnapshot } from './gameplay/PreSnapCadenceModel';
import {
  getRosterPlayerForGameplayId,
  type GameplayRosterBinding,
} from './roster/GameplayRosterBinding';
import {
  getReadableTextColor,
  type TeamPresentationTheme,
} from './teams/TeamThemeApplier';
import {
  formatWholeFootballYards,
  formatYardGainForDisplay,
  formatYardsToGoForDisplay,
} from './yardDisplay';

export interface GameplayHud {
  cadenceStatus: HTMLDivElement;
  clock: HTMLDivElement;
  driveStatus: HTMLDivElement;
  gameOverMessage: HTMLDivElement;
  incompleteMessage: HTMLDivElement;
  outOfBoundsMessage: HTMLDivElement;
  passWarningMessage: HTMLDivElement;
  playCall: HTMLDivElement;
  resultMessage: HTMLDivElement;
  root: HTMLDivElement;
  sackMessage: HTMLDivElement;
  safetyMessage: HTMLDivElement;
  score: HTMLDivElement;
  tackleMessage: HTMLDivElement;
  targetLabel: HTMLDivElement;
  touchdownMessage: HTMLDivElement;
  turnoverMessage: HTMLDivElement;
}

export function createGameplayHud(): GameplayHud {
  const root = document.createElement('div');
  root.className = 'gameplay-hud';

  const clock = document.createElement('div');
  clock.className = 'game-clock';
  root.appendChild(clock);

  const score = document.createElement('div');
  score.className = 'score-counter';
  root.appendChild(score);

  const driveStatus = document.createElement('div');
  driveStatus.className = 'drive-status';
  driveStatus.hidden = true;
  driveStatus.setAttribute('aria-hidden', 'true');
  root.appendChild(driveStatus);

  const cadenceStatus = document.createElement('div');
  cadenceStatus.className = 'cadence-status';
  cadenceStatus.hidden = true;
  root.appendChild(cadenceStatus);

  const playCall = document.createElement('div');
  playCall.className = 'play-call';
  playCall.hidden = true;
  playCall.setAttribute('aria-hidden', 'true');
  root.appendChild(playCall);

  const targetLabel = document.createElement('div');
  targetLabel.className = 'target-label';
  root.appendChild(targetLabel);

  const touchdownMessage = document.createElement('div');
  touchdownMessage.className = 'touchdown-message';
  touchdownMessage.textContent = 'TOUCHDOWN';
  root.appendChild(touchdownMessage);

  const tackleMessage = document.createElement('div');
  tackleMessage.className = 'tackle-message';
  tackleMessage.textContent = 'TACKLED';
  root.appendChild(tackleMessage);

  const sackMessage = document.createElement('div');
  sackMessage.className = 'sack-message';
  sackMessage.textContent = 'SACK';
  root.appendChild(sackMessage);

  const safetyMessage = document.createElement('div');
  safetyMessage.className = 'safety-message';
  safetyMessage.textContent = 'SAFETY';
  root.appendChild(safetyMessage);

  const outOfBoundsMessage = document.createElement('div');
  outOfBoundsMessage.className = 'out-of-bounds-message';
  outOfBoundsMessage.textContent = 'OUT OF BOUNDS';
  root.appendChild(outOfBoundsMessage);

  const incompleteMessage = document.createElement('div');
  incompleteMessage.className = 'incomplete-message';
  incompleteMessage.textContent = 'INCOMPLETE';
  root.appendChild(incompleteMessage);

  const passWarningMessage = document.createElement('div');
  passWarningMessage.className = 'pass-warning-message';
  passWarningMessage.textContent = 'PAST LINE OF SCRIMMAGE';
  root.appendChild(passWarningMessage);

  const resultMessage = document.createElement('div');
  resultMessage.className = 'result-message';
  root.appendChild(resultMessage);

  const turnoverMessage = document.createElement('div');
  turnoverMessage.className = 'turnover-message';
  turnoverMessage.textContent = 'TURNOVER ON DOWNS';
  root.appendChild(turnoverMessage);

  const gameOverMessage = document.createElement('div');
  gameOverMessage.className = 'game-over-message';
  root.appendChild(gameOverMessage);

  document.body.appendChild(root);

  return {
    cadenceStatus,
    clock,
    driveStatus,
    gameOverMessage,
    incompleteMessage,
    outOfBoundsMessage,
    passWarningMessage,
    playCall,
    resultMessage,
    root,
    sackMessage,
    safetyMessage,
    score,
    tackleMessage,
    targetLabel,
    touchdownMessage,
    turnoverMessage,
  };
}

export function syncGameplayHud(
  hud: GameplayHud,
  gameplay: GameplaySnapshot,
  teamTheme: TeamPresentationTheme | null = null,
  rosterBinding: GameplayRosterBinding | null = null,
  cadence: PreSnapCadenceSnapshot | null = null,
): void {
  if (teamTheme) {
    applyGameplayHudTeamTheme(hud, teamTheme);
  }
  const lastPlayResult = gameplay.lastPlayResult;
  const isTurnoverOnDowns = gameplay.drive.lastDriveResult?.type === 'turnoverOnDowns';
  const isGameOver = gameplay.playState === 'gameOver';

  hud.clock.textContent = `Time ${formatClock(gameplay.scoreAttack.remainingSeconds)}`;
  hud.score.textContent = `Score ${gameplay.score}`;
  hud.driveStatus.textContent = `${formatDown(gameplay.drive.currentDown)} & ${formatDistance(
    gameplay.drive.yardsToFirstDown,
  )} | Ball ${formatWholeFootballYards(gameplay.drive.lineOfScrimmage.z)}`;
  hud.driveStatus.hidden = true;
  hud.driveStatus.setAttribute('aria-hidden', 'true');
  hud.playCall.textContent = gameplay.selectedPlay.displayName;
  hud.playCall.hidden = true;
  hud.playCall.setAttribute('aria-hidden', 'true');
  hud.targetLabel.hidden = !gameplay.selectedReceiver;
  hud.targetLabel.textContent = gameplay.selectedReceiver
    ? `Target ${formatTargetLabel(gameplay.selectedReceiver, rosterBinding)}`
    : '';
  hud.cadenceStatus.hidden =
    gameplay.playState !== 'preSnap' ||
    !cadence ||
    cadence.hudText.length === 0;
  hud.cadenceStatus.textContent = cadence?.hudText ?? '';
  hud.cadenceStatus.dataset.phase = cadence?.phase ?? 'hidden';
  hud.cadenceStatus.dataset.warning = cadence?.earlySnapWarningVisible ? 'true' : 'false';
  hud.tackleMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'tackle';
  hud.sackMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'sack';
  hud.safetyMessage.hidden = isGameOver || lastPlayResult?.type !== 'safety';
  hud.touchdownMessage.hidden = isGameOver || lastPlayResult?.type !== 'touchdown';
  hud.outOfBoundsMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'outOfBounds';
  hud.incompleteMessage.hidden = isGameOver || isTurnoverOnDowns || lastPlayResult?.type !== 'incomplete';
  hud.passWarningMessage.hidden = isGameOver || gameplay.passFeedback !== 'pastLineOfScrimmage';
  hud.turnoverMessage.hidden = isGameOver || !isTurnoverOnDowns;
  hud.resultMessage.hidden =
    isGameOver ||
    !lastPlayResult ||
    !['tackle', 'outOfBounds', 'incomplete', 'sack', 'safety'].includes(lastPlayResult.type);
  hud.resultMessage.textContent = lastPlayResult ? formatYards(lastPlayResult.yardsGained) : '';
  hud.gameOverMessage.hidden = !isGameOver;
  hud.gameOverMessage.textContent = isGameOver
    ? `FINAL SCORE ${gameplay.scoreAttack.finalScore ?? gameplay.score} - PRESS ENTER`
    : '';
}

function formatTargetLabel(
  selectedReceiver: NonNullable<GameplaySnapshot['selectedReceiver']>,
  rosterBinding: GameplayRosterBinding | null,
): string {
  const rosterPlayer = rosterBinding
    ? getRosterPlayerForGameplayId(rosterBinding, selectedReceiver.id)
    : null;

  if (!rosterPlayer) {
    return selectedReceiver.displayName;
  }

  return `#${rosterPlayer.jerseyNumber} ${rosterPlayer.displayName}`;
}

export function applyGameplayHudTeamTheme(
  hud: GameplayHud,
  teamTheme: TeamPresentationTheme,
): void {
  if (hud.root.dataset.teamKey === teamTheme.teamKey) {
    return;
  }

  hud.root.dataset.teamKey = teamTheme.teamKey;
  hud.root.style.setProperty('--scorebug-user-bg', teamTheme.offense.profile.colors.primary);
  hud.root.style.setProperty(
    '--scorebug-user-text',
    getReadableTextColor(teamTheme.offense.profile.colors.primary),
  );
  hud.root.style.setProperty('--scorebug-opponent-bg', teamTheme.defense.profile.colors.primary);
  hud.root.style.setProperty(
    '--scorebug-opponent-text',
    getReadableTextColor(teamTheme.defense.profile.colors.primary),
  );
  hud.root.style.setProperty('--scorebug-accent', teamTheme.offense.profile.colors.accent);
  hud.root.style.setProperty('--scorebug-secondary', teamTheme.offense.profile.colors.secondary);
}

function formatClock(totalSeconds: number): string {
  const clampedSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(clampedSeconds / 60);
  const seconds = clampedSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDown(down: number): string {
  if (down === 1) {
    return '1st';
  }

  if (down === 2) {
    return '2nd';
  }

  if (down === 3) {
    return '3rd';
  }

  return `${down}th`;
}

function formatDistance(yardsToFirstDown: number): string {
  return formatYardsToGoForDisplay(yardsToFirstDown);
}

function formatYards(yardsGained: number): string {
  return formatYardGainForDisplay(yardsGained);
}
