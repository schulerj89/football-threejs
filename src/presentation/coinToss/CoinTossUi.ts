import type { CoinFace } from '../../match/CoinTossModel';
import type { MatchSnapshot } from '../../match/MatchTypes';

export interface CoinTossUiSnapshot {
  confirmedCall: CoinFace | null;
  selectedCall: CoinFace;
}

export class CoinTossUi {
  readonly root = document.createElement('section');
  private readonly headsButton = document.createElement('button');
  private readonly tailsButton = document.createElement('button');
  private readonly heading = document.createElement('h2');
  private readonly status = document.createElement('p');
  private readonly result = document.createElement('p');
  private confirmedCall: CoinFace | null = null;
  private selectedCall: CoinFace = 'heads';
  private visible = false;

  constructor() {
    this.root.className = 'coin-toss-ui';
    this.root.setAttribute('aria-label', 'Coin toss');
    this.root.hidden = true;

    this.heading.textContent = 'Call the toss';
    this.status.className = 'coin-toss-status';
    this.result.className = 'coin-toss-result';

    const actions = document.createElement('div');
    actions.className = 'coin-toss-actions';
    this.configureButton(this.headsButton, 'heads');
    this.configureButton(this.tailsButton, 'tails');
    actions.append(this.headsButton, this.tailsButton);

    this.root.append(this.heading, this.status, actions, this.result);
    document.body.append(this.root);
    window.addEventListener('keydown', this.handleKeyDown);
    this.syncButtons();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
  }

  reset(): void {
    this.confirmedCall = null;
    this.selectedCall = 'heads';
    this.root.dataset.phase = 'awaitingCall';
    this.heading.textContent = 'Call the toss';
    this.result.textContent = '';
    this.syncButtons();
  }

  sync(matchSnapshot: MatchSnapshot | null): void {
    const coinToss = matchSnapshot?.coinToss ?? null;
    const callLocked = Boolean(coinToss?.userCall);

    this.headsButton.disabled = callLocked;
    this.tailsButton.disabled = callLocked;
    this.root.dataset.phase = coinToss?.phase ?? 'awaitingCall';

    if (!coinToss || !coinToss.userCall) {
      this.heading.textContent = 'Call the toss';
      this.status.textContent = 'Choose HEADS or TAILS, then press Enter.';
      this.result.textContent = '';
      this.syncButtons();
      return;
    }

    this.selectedCall = coinToss.userCall;
    this.heading.textContent = 'Coin toss';
    this.status.textContent = `You called ${formatFace(coinToss.userCall)}.`;

    if (matchSnapshot && coinToss.resolvedFace && coinToss.winner) {
      const winner = coinToss.winner === 'user'
        ? matchSnapshot.userTeam.displayName
        : matchSnapshot.opponentTeam.displayName;
      this.result.textContent = `${formatFace(coinToss.resolvedFace)}. ${winner} will receive.`;
    } else {
      this.result.textContent = '';
    }
    this.syncButtons();
  }

  consumeConfirmedCall(): CoinFace | null {
    const call = this.confirmedCall;
    this.confirmedCall = null;
    return call;
  }

  getSnapshot(): CoinTossUiSnapshot {
    return {
      confirmedCall: this.confirmedCall,
      selectedCall: this.selectedCall,
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.root.remove();
  }

  private configureButton(button: HTMLButtonElement, face: CoinFace): void {
    button.type = 'button';
    button.className = 'coin-toss-choice';
    button.dataset.face = face;
    button.innerHTML = [
      `<img src="/branding/coin/football-js-coin-${face}.webp" alt="" aria-hidden="true">`,
      `<span>${formatFace(face)}</span>`,
    ].join('');
    button.addEventListener('click', () => {
      this.selectedCall = face;
      this.confirmedCall = face;
      this.syncButtons();
    });
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.visible || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'arrowright') {
      this.selectedCall = this.selectedCall === 'heads' ? 'tails' : 'heads';
      this.syncButtons();
      event.preventDefault();
      return;
    }

    if (key === 'h') {
      this.selectedCall = 'heads';
      this.syncButtons();
      event.preventDefault();
      return;
    }

    if (key === 't') {
      this.selectedCall = 'tails';
      this.syncButtons();
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter') {
      this.confirmedCall = this.selectedCall;
      this.syncButtons();
      event.preventDefault();
    }
  };

  private syncButtons(): void {
    this.headsButton.dataset.selected = String(this.selectedCall === 'heads');
    this.tailsButton.dataset.selected = String(this.selectedCall === 'tails');
  }
}

function formatFace(face: CoinFace): string {
  return face.toUpperCase();
}
