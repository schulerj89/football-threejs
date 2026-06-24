import type { SnapPlacement } from './ballSpotting';
import {
  PLAY_CALL_DIAGRAM_SIZE,
  createPlayCallDiagramModel,
  type PlayCallBlockerAssignment,
  type PlayCallCoverageZone,
  type PlayCallDiagramModel,
  type PlayCallRoute,
  type SvgPoint,
} from './playCallDiagram';
import type { GameplaySnapshot } from './playState';
import { PLAYS, type PlayDefinition, type PlayId } from './playbook';
import {
  getReadableTextColor,
  type TeamPresentationTheme,
} from './teams/TeamThemeApplier';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export class PlayCallUi {
  readonly root: HTMLDivElement;
  private enabled = false;
  private readonly actions: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly hint: HTMLSpanElement;
  private readonly puntButton: HTMLButtonElement;
  private lastRenderKey = '';
  private pendingSelectedPlayId: string | null = null;
  private puntAvailable = false;
  private selectionLocked = false;
  private currentPreSnapKey: string | null = null;
  private dismissedForPreSnapKey: string | null = null;

  constructor(
    private plays: PlayDefinition[] = PLAYS,
    private teamTheme: TeamPresentationTheme | null = null,
    private readonly onPunt: (() => void) | null = null,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'play-call-ui';
    this.root.hidden = true;

    const header = document.createElement('div');
    header.className = 'play-call-tray-header';
    const heading = document.createElement('h2');
    heading.textContent = 'Choose a Play';
    this.hint = document.createElement('span');
    this.syncShortcutHint();
    header.append(heading, this.hint);
    this.root.appendChild(header);

    this.grid = document.createElement('div');
    this.grid.className = 'play-call-grid';
    this.root.appendChild(this.grid);

    this.actions = document.createElement('div');
    this.actions.className = 'play-call-actions';
    this.puntButton = document.createElement('button');
    this.puntButton.className = 'play-call-punt-button';
    this.puntButton.type = 'button';
    this.puntButton.textContent = 'PUNT';
    this.puntButton.setAttribute('aria-label', 'Punt');
    this.puntButton.addEventListener('click', this.handlePuntClick);
    this.actions.append(this.puntButton);
    this.root.appendChild(this.actions);

    this.root.addEventListener('pointerdown', this.handlePointerDown);
    this.root.addEventListener('pointerup', this.handlePointerUp);
    document.body.appendChild(this.root);
  }

  consumeSelectedPlayId(): string | null {
    const selectedPlayId = this.pendingSelectedPlayId;
    this.pendingSelectedPlayId = null;

    return selectedPlayId;
  }

  setPlays(plays: PlayDefinition[]): void {
    this.plays = plays;
    this.syncShortcutHint();
    this.lastRenderKey = '';
    this.pendingSelectedPlayId = null;
    this.currentPreSnapKey = null;
    this.dismissedForPreSnapKey = null;
    this.grid.replaceChildren();
  }

  setTeamTheme(teamTheme: TeamPresentationTheme): void {
    if (this.teamTheme?.teamKey === teamTheme.teamKey) {
      return;
    }

    this.teamTheme = teamTheme;
    this.lastRenderKey = '';
  }

  hide(): void {
    this.enabled = false;
    this.currentPreSnapKey = null;
    this.dismissedForPreSnapKey = null;
    this.root.hidden = true;
  }

  dismissAfterSelection(): void {
    this.dismissedForPreSnapKey = this.currentPreSnapKey;
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.removeEventListener('pointerdown', this.handlePointerDown);
    this.root.removeEventListener('pointerup', this.handlePointerUp);
    this.puntButton.removeEventListener('click', this.handlePuntClick);
    this.root.remove();
    this.pendingSelectedPlayId = null;
  }

  sync(gameplay: GameplaySnapshot, options: { canPunt?: boolean; selectionLocked?: boolean } = {}): void {
    this.enabled = gameplay.playState === 'preSnap';
    this.puntAvailable = this.enabled && Boolean(options.canPunt);
    this.selectionLocked = Boolean(options.selectionLocked);
    const preSnapKey = this.enabled ? createPreSnapDisplayKey(gameplay) : null;
    if (preSnapKey !== this.currentPreSnapKey) {
      this.currentPreSnapKey = preSnapKey;
      this.dismissedForPreSnapKey = null;
    }
    const dismissed = preSnapKey !== null && this.dismissedForPreSnapKey === preSnapKey;
    this.root.hidden = !this.enabled || dismissed;
    this.root.dataset.selectionLocked = this.selectionLocked ? 'true' : 'false';
    this.actions.hidden = !this.puntAvailable || this.selectionLocked;
    this.puntButton.disabled = !this.puntAvailable || this.selectionLocked;

    if (!this.enabled) {
      this.currentPreSnapKey = null;
      this.dismissedForPreSnapKey = null;
      return;
    }

    if (dismissed) {
      return;
    }

    const renderKey = [
      gameplay.selectedPlay.id,
      gameplay.drive.snapLane,
      gameplay.drive.lineOfScrimmage.x.toFixed(3),
      gameplay.drive.lineOfScrimmage.z.toFixed(3),
      this.teamTheme?.teamKey ?? 'default',
      this.selectionLocked ? 'locked' : 'selectable',
    ].join('|');

    if (renderKey === this.lastRenderKey) {
      return;
    }

    this.lastRenderKey = renderKey;
    this.renderCards(gameplay);
    this.scrollSelectedCardIntoView();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || this.selectionLocked) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('.play-card')) {
      event.preventDefault();
    }
  };

  private readonly handlePuntClick = (event: MouseEvent): void => {
    if (!this.enabled || this.selectionLocked || !this.puntAvailable || !this.onPunt) {
      return;
    }

    this.dismissAfterSelection();
    this.onPunt();
    this.puntButton.blur();
    event.preventDefault();
  };

  private renderCards(gameplay: GameplaySnapshot): void {
    const snapPlacement: SnapPlacement = {
      lane: gameplay.drive.snapLane,
      spot: gameplay.drive.lineOfScrimmage,
    };
    const cards = this.plays.map((play) =>
      createPlayCard(
        play,
        snapPlacement,
        gameplay.selectedPlay.id,
        this.teamTheme,
        this.plays.indexOf(play) + 1,
        this.selectionLocked,
      ),
    );

    this.grid.replaceChildren(...cards);
  }

  private syncShortcutHint(): void {
    this.hint.textContent = `Click or press 1-${this.plays.length}`;
  }

  private scrollSelectedCardIntoView(): void {
    const selectedCard = this.grid.querySelector<HTMLElement>('.play-card[data-selected="true"]');

    if (!selectedCard) {
      return;
    }

    const scroll = (): void => {
      selectedCard.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    };

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(scroll);
    } else {
      scroll();
    }
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.enabled || this.selectionLocked) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const card = target.closest<HTMLButtonElement>('.play-card');
    const playId = card?.dataset.playId;

    if (!playId) {
      return;
    }

    this.pendingSelectedPlayId = playId;
    this.dismissAfterSelection();
    card.blur();
    event.preventDefault();
  };
}

export function createPlayCallUi(
  plays: PlayDefinition[] = PLAYS,
  teamTheme: TeamPresentationTheme | null = null,
  onPunt: (() => void) | null = null,
): PlayCallUi {
  return new PlayCallUi(plays, teamTheme, onPunt);
}

export function syncPlayCallUi(
  ui: PlayCallUi,
  gameplay: GameplaySnapshot,
  options: { canPunt?: boolean; selectionLocked?: boolean } = {},
): void {
  ui.sync(gameplay, options);
}

function createPlayCard(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
  selectedPlayId: PlayId,
  teamTheme: TeamPresentationTheme | null,
  shortcutNumber: number,
  selectionLocked: boolean,
): HTMLButtonElement {
  const selected = play.id === selectedPlayId;
  const model = createPlayCallDiagramModel(play, snapPlacement);
  const card = document.createElement('button');
  card.className = 'play-card';
  card.dataset.kind = play.kind;
  card.dataset.playId = play.id;
  card.dataset.selected = selected ? 'true' : 'false';
  card.dataset.locked = selectionLocked ? 'true' : 'false';
  card.dataset.shortcut = shortcutNumber.toString();
  card.disabled = selectionLocked;
  card.type = 'button';
  card.setAttribute('aria-label', createPlayCardAccessibilityLabel(play, shortcutNumber));
  card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  applyCardTheme(card, teamTheme);

  const cardHeader = document.createElement('div');
  cardHeader.className = 'play-card-header';
  const title = document.createElement('div');
  title.className = 'play-card-title';
  title.textContent = play.displayName;
  const badge = document.createElement('span');
  badge.className = 'play-card-kind-badge';
  badge.textContent = play.kind === 'pass' ? 'Pass' : 'Run';
  const shortcut = document.createElement('span');
  shortcut.className = 'play-card-shortcut';
  shortcut.textContent = shortcutNumber.toString();
  cardHeader.append(title, badge, shortcut);
  card.appendChild(cardHeader);
  card.appendChild(createDiagramSvg(model, teamTheme));

  return card;
}

export interface PlayCallTrayLayout {
  cardCount: number;
  columns: number;
  mode: 'desktopGrid' | 'horizontalScroll';
  rows: number;
}

export function resolvePlayCallTrayLayout(
  viewportWidth: number,
  cardCount: number,
): PlayCallTrayLayout {
  if (viewportWidth < 760) {
    return {
      cardCount,
      columns: Math.max(1, cardCount),
      mode: 'horizontalScroll',
      rows: 1,
    };
  }

  const columns = Math.min(3, Math.max(1, cardCount));

  return {
    cardCount,
    columns,
    mode: 'desktopGrid',
    rows: Math.ceil(cardCount / columns),
  };
}

export function createPlayCardAccessibilityLabel(
  play: PlayDefinition,
  shortcutNumber: number,
): string {
  return `${play.displayName}, ${play.kind === 'pass' ? 'pass' : 'run'} play, shortcut ${shortcutNumber}`;
}

function createDiagramSvg(
  model: PlayCallDiagramModel,
  teamTheme: TeamPresentationTheme | null,
): SVGSVGElement {
  const svg = createSvgElement('svg');
  svg.classList.add('play-card-diagram');
  svg.dataset.playId = model.playId;
  svg.dataset.coverageZones = model.coverageZones.length.toString();
  svg.dataset.receiverRoutes = model.receiverRoutes.length.toString();
  svg.setAttribute('viewBox', `0 0 ${PLAY_CALL_DIAGRAM_SIZE.width} ${PLAY_CALL_DIAGRAM_SIZE.height}`);
  svg.setAttribute('aria-hidden', 'true');

  const routeMarkerId = `${model.playId}-route-arrow`;
  const runMarkerId = `${model.playId}-run-arrow`;
  svg.appendChild(createArrowDefs(routeMarkerId, runMarkerId));
  svg.appendChild(createFieldBackground());
  svg.appendChild(createLine(
    model.lineOfScrimmage.start,
    model.lineOfScrimmage.end,
    'play-card-line-of-scrimmage',
  ));

  for (const zone of model.coverageZones) {
    svg.appendChild(createCoverageZone(zone));
  }

  for (const assignment of model.blockerAssignments) {
    svg.appendChild(createBlockerAssignment(assignment));
  }

  if (model.runDirection) {
    const runPath = createArrowPath(
      model.runDirection.points,
      'play-card-run-direction',
      runMarkerId,
    );
    if (teamTheme) {
      runPath.style.stroke = teamTheme.offense.uniform.stripe;
    }
    svg.appendChild(runPath);
  }

  for (const route of model.receiverRoutes) {
    const routePath = createArrowPath(route.points, 'play-card-receiver-route', routeMarkerId);
    if (teamTheme) {
      routePath.style.stroke = teamTheme.offense.uniform.number;
    }
    svg.appendChild(routePath);
    for (const point of route.breakPoints) {
      const marker = createBreakMarker(point);
      if (teamTheme) {
        marker.style.fill = teamTheme.offense.uniform.number;
      }
      svg.appendChild(marker);
    }
  }

  for (const player of model.players) {
    svg.appendChild(player.role === 'quarterback'
      ? createQuarterbackMarker(player.point, teamTheme)
      : createPlayerMarker(player.point, teamTheme));
  }

  svg.appendChild(createBallMarker(model.ball));

  return svg;
}

function createArrowDefs(routeMarkerId: string, runMarkerId: string): SVGDefsElement {
  const defs = createSvgElement('defs');
  defs.appendChild(createArrowMarker(routeMarkerId, 'play-card-route-arrowhead'));
  defs.appendChild(createArrowMarker(runMarkerId, 'play-card-run-arrowhead'));

  return defs;
}

function createArrowMarker(id: string, className: string): SVGMarkerElement {
  const marker = createSvgElement('marker');
  marker.classList.add(className);
  marker.id = id;
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('refX', '7');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('viewBox', '0 0 8 7');

  const path = createSvgElement('path');
  path.setAttribute('d', 'M0,0 L8,3.5 L0,7 Z');
  marker.appendChild(path);

  return marker;
}

function createFieldBackground(): SVGGElement {
  const group = createSvgElement('g');
  const background = createSvgElement('rect');
  background.classList.add('play-card-field-background');
  background.setAttribute('height', PLAY_CALL_DIAGRAM_SIZE.height.toString());
  background.setAttribute('rx', '4');
  background.setAttribute('width', PLAY_CALL_DIAGRAM_SIZE.width.toString());
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  group.appendChild(background);

  for (let index = 1; index < 5; index += 1) {
    const y = (PLAY_CALL_DIAGRAM_SIZE.height / 5) * index;
    const stripe = createLine(
      { x: 0, y },
      { x: PLAY_CALL_DIAGRAM_SIZE.width, y },
      'play-card-field-stripe',
    );
    group.appendChild(stripe);
  }

  return group;
}

function createPlayerMarker(
  point: SvgPoint,
  teamTheme: TeamPresentationTheme | null,
): SVGCircleElement {
  const circle = createSvgElement('circle');
  circle.classList.add('play-card-offense-marker');
  circle.setAttribute('cx', point.x.toFixed(2));
  circle.setAttribute('cy', point.y.toFixed(2));
  circle.setAttribute('r', '4.1');
  if (teamTheme) {
    circle.style.fill = teamTheme.offense.uniform.jersey;
  }

  return circle;
}

function createQuarterbackMarker(
  point: SvgPoint,
  teamTheme: TeamPresentationTheme | null,
): SVGPolygonElement {
  const marker = createSvgElement('polygon');
  const size = 5.2;
  const points = [
    `${point.x.toFixed(2)},${(point.y - size).toFixed(2)}`,
    `${(point.x + size).toFixed(2)},${point.y.toFixed(2)}`,
    `${point.x.toFixed(2)},${(point.y + size).toFixed(2)}`,
    `${(point.x - size).toFixed(2)},${point.y.toFixed(2)}`,
  ];
  marker.classList.add('play-card-quarterback-marker');
  marker.setAttribute('points', points.join(' '));
  if (teamTheme) {
    marker.style.fill = teamTheme.offense.uniform.helmetShell;
  }

  return marker;
}

function createBallMarker(point: SvgPoint): SVGCircleElement {
  const circle = createSvgElement('circle');
  circle.classList.add('play-card-ball-marker');
  circle.setAttribute('cx', point.x.toFixed(2));
  circle.setAttribute('cy', point.y.toFixed(2));
  circle.setAttribute('r', '2.6');

  return circle;
}

function createBlockerAssignment(assignment: PlayCallBlockerAssignment): SVGGElement {
  const group = createSvgElement('g');
  group.classList.add('play-card-blocker-assignment');
  group.dataset.kind = assignment.kind;
  group.dataset.defenderId = assignment.defenderId ?? '';
  const lineClass = assignment.kind === 'passProtection'
    ? 'play-card-pass-protection-line'
    : 'play-card-blocker-line';
  group.appendChild(createLine(assignment.start, assignment.end, lineClass));
  group.appendChild(createAssignmentBar(assignment.start, assignment.end, assignment.kind));

  return group;
}

function createCoverageZone(zone: PlayCallCoverageZone): SVGGElement {
  const group = createSvgElement('g');
  group.classList.add('play-card-coverage-zone');
  group.dataset.defenderId = zone.defenderId;
  group.dataset.kind = zone.kind;
  group.dataset.label = zone.label;

  const polygon = createSvgElement('polygon');
  polygon.classList.add('play-card-coverage-zone-shape');
  polygon.setAttribute(
    'points',
    zone.points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
  );
  group.appendChild(polygon);

  const landmark = createSvgElement('circle');
  landmark.classList.add('play-card-coverage-zone-landmark');
  landmark.setAttribute('cx', zone.landmark.x.toFixed(2));
  landmark.setAttribute('cy', zone.landmark.y.toFixed(2));
  landmark.setAttribute('r', zone.kind === 'deepHalf' || zone.kind === 'deepMiddle' ? '2.35' : '1.9');
  group.appendChild(landmark);

  return group;
}

function createAssignmentBar(
  start: SvgPoint,
  end: SvgPoint,
  kind: PlayCallBlockerAssignment['kind'],
): SVGLineElement {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  const center = {
    x: start.x + deltaX * 0.68,
    y: start.y + deltaY * 0.68,
  };
  const normal = length === 0
    ? { x: 1, y: 0 }
    : { x: -deltaY / length, y: deltaX / length };
  const halfLength = 4;

  const bar = createLine(
    {
      x: center.x - normal.x * halfLength,
      y: center.y - normal.y * halfLength,
    },
    {
      x: center.x + normal.x * halfLength,
      y: center.y + normal.y * halfLength,
    },
    kind === 'passProtection'
      ? 'play-card-pass-protection-bar'
      : 'play-card-blocker-bar',
  );

  return bar;
}

function createArrowPath(
  points: readonly SvgPoint[],
  className: string,
  markerId: string,
): SVGPolylineElement {
  const line = createSvgElement('polyline');
  line.classList.add(className);
  const visiblePoints = insetArrowEndpoint(points);
  line.setAttribute(
    'points',
    visiblePoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
  );
  line.setAttribute('fill', 'none');
  line.setAttribute('marker-end', `url(#${markerId})`);
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');

  return line;
}

function createLine(start: SvgPoint, end: SvgPoint, className: string): SVGLineElement {
  const line = createSvgElement('line');
  line.classList.add(className);
  line.setAttribute('x1', start.x.toFixed(2));
  line.setAttribute('y1', start.y.toFixed(2));
  line.setAttribute('x2', end.x.toFixed(2));
  line.setAttribute('y2', end.y.toFixed(2));
  line.setAttribute('stroke-linecap', 'round');

  return line;
}

function createBreakMarker(point: SvgPoint): SVGCircleElement {
  const circle = createSvgElement('circle');
  circle.classList.add('play-card-route-break');
  circle.setAttribute('cx', point.x.toFixed(2));
  circle.setAttribute('cy', point.y.toFixed(2));
  circle.setAttribute('r', '2.15');

  return circle;
}

function insetArrowEndpoint(points: readonly SvgPoint[]): SvgPoint[] {
  if (points.length < 2) {
    return [...points];
  }

  const visiblePoints = points.map((point) => ({ ...point }));
  const end = visiblePoints[visiblePoints.length - 1];
  const previous = visiblePoints[visiblePoints.length - 2];
  const deltaX = end.x - previous.x;
  const deltaY = end.y - previous.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length <= 0.001) {
    return visiblePoints;
  }

  const inset = Math.min(5.25, length * 0.42);
  visiblePoints[visiblePoints.length - 1] = {
    x: end.x - (deltaX / length) * inset,
    y: end.y - (deltaY / length) * inset,
  };

  return visiblePoints;
}

function applyCardTheme(
  card: HTMLButtonElement,
  teamTheme: TeamPresentationTheme | null,
): void {
  if (!teamTheme) {
    return;
  }

  const jersey = teamTheme.offense.uniform.jersey;
  card.style.setProperty('--play-card-team', jersey);
  card.style.setProperty('--play-card-team-text', getReadableTextColor(jersey));
  card.style.setProperty('--play-card-accent', teamTheme.offense.uniform.stripe);
  card.style.setProperty('--play-card-route', teamTheme.offense.uniform.number);
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}

function createPreSnapDisplayKey(gameplay: GameplaySnapshot): string {
  return [
    gameplay.drive.currentDown,
    gameplay.drive.snapLane,
    gameplay.drive.lineOfScrimmage.x.toFixed(3),
    gameplay.drive.lineOfScrimmage.z.toFixed(3),
    gameplay.drive.firstDownMarker.z.toFixed(3),
  ].join('|');
}
