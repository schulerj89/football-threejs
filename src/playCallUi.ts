import type { SnapPlacement } from './ballSpotting';
import {
  PLAY_CALL_DIAGRAM_SIZE,
  createPlayCallDiagramModel,
  type PlayCallBlockerAssignment,
  type PlayCallDiagramModel,
  type PlayCallRoute,
  type SvgPoint,
} from './playCallDiagram';
import type { GameplaySnapshot } from './playState';
import { PLAYS, type PlayDefinition, type PlayId } from './playbook';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export class PlayCallUi {
  readonly root: HTMLDivElement;
  private enabled = false;
  private readonly grid: HTMLDivElement;
  private lastRenderKey = '';
  private pendingSelectedPlayId: string | null = null;

  constructor(private readonly plays: PlayDefinition[] = PLAYS) {
    this.root = document.createElement('div');
    this.root.className = 'play-call-ui';
    this.root.hidden = true;

    this.grid = document.createElement('div');
    this.grid.className = 'play-call-grid';
    this.root.appendChild(this.grid);
    this.root.addEventListener('pointerup', this.handlePointerUp);
    document.body.appendChild(this.root);
  }

  consumeSelectedPlayId(): string | null {
    const selectedPlayId = this.pendingSelectedPlayId;
    this.pendingSelectedPlayId = null;

    return selectedPlayId;
  }

  sync(gameplay: GameplaySnapshot): void {
    this.enabled = gameplay.playState === 'preSnap';
    this.root.hidden = !this.enabled;

    if (!this.enabled) {
      return;
    }

    const renderKey = [
      gameplay.selectedPlay.id,
      gameplay.drive.snapLane,
      gameplay.drive.lineOfScrimmage.x.toFixed(3),
      gameplay.drive.lineOfScrimmage.z.toFixed(3),
    ].join('|');

    if (renderKey === this.lastRenderKey) {
      return;
    }

    this.lastRenderKey = renderKey;
    this.renderCards(gameplay);
  }

  private renderCards(gameplay: GameplaySnapshot): void {
    const snapPlacement: SnapPlacement = {
      lane: gameplay.drive.snapLane,
      spot: gameplay.drive.lineOfScrimmage,
    };
    const cards = this.plays.map((play) =>
      createPlayCard(play, snapPlacement, gameplay.selectedPlay.id),
    );

    this.grid.replaceChildren(...cards);
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.enabled) {
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
    event.preventDefault();
  };
}

export function createPlayCallUi(plays: PlayDefinition[] = PLAYS): PlayCallUi {
  return new PlayCallUi(plays);
}

export function syncPlayCallUi(ui: PlayCallUi, gameplay: GameplaySnapshot): void {
  ui.sync(gameplay);
}

function createPlayCard(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
  selectedPlayId: PlayId,
): HTMLButtonElement {
  const selected = play.id === selectedPlayId;
  const model = createPlayCallDiagramModel(play, snapPlacement);
  const card = document.createElement('button');
  card.className = 'play-card';
  card.dataset.kind = play.kind;
  card.dataset.playId = play.id;
  card.dataset.selected = selected ? 'true' : 'false';
  card.type = 'button';
  card.setAttribute('aria-label', play.displayName);
  card.setAttribute('aria-pressed', selected ? 'true' : 'false');

  const title = document.createElement('div');
  title.className = 'play-card-title';
  title.textContent = play.displayName;
  card.appendChild(title);
  card.appendChild(createDiagramSvg(model));

  return card;
}

function createDiagramSvg(model: PlayCallDiagramModel): SVGSVGElement {
  const svg = createSvgElement('svg');
  svg.classList.add('play-card-diagram');
  svg.dataset.playId = model.playId;
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

  for (const assignment of model.blockerAssignments) {
    svg.appendChild(createBlockerAssignment(assignment));
  }

  if (model.runDirection) {
    svg.appendChild(createArrowLine(
      model.runDirection.start,
      model.runDirection.end,
      'play-card-run-direction',
      runMarkerId,
    ));
  }

  for (const route of model.receiverRoutes) {
    svg.appendChild(createArrowLine(route.start, route.end, 'play-card-receiver-route', routeMarkerId));
  }

  for (const player of model.players) {
    svg.appendChild(player.role === 'quarterback'
      ? createQuarterbackMarker(player.point)
      : createPlayerMarker(player.point));
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

function createPlayerMarker(point: SvgPoint): SVGCircleElement {
  const circle = createSvgElement('circle');
  circle.classList.add('play-card-offense-marker');
  circle.setAttribute('cx', point.x.toFixed(2));
  circle.setAttribute('cy', point.y.toFixed(2));
  circle.setAttribute('r', '4.1');

  return circle;
}

function createQuarterbackMarker(point: SvgPoint): SVGPolygonElement {
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
  group.appendChild(createLine(assignment.start, assignment.end, 'play-card-blocker-line'));
  group.appendChild(createAssignmentBar(assignment.start, assignment.end));

  return group;
}

function createAssignmentBar(start: SvgPoint, end: SvgPoint): SVGLineElement {
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

  return createLine(
    {
      x: center.x - normal.x * halfLength,
      y: center.y - normal.y * halfLength,
    },
    {
      x: center.x + normal.x * halfLength,
      y: center.y + normal.y * halfLength,
    },
    'play-card-blocker-bar',
  );
}

function createArrowLine(
  start: SvgPoint,
  end: SvgPoint,
  className: string,
  markerId: string,
): SVGLineElement {
  const line = createLine(start, end, className);
  line.setAttribute('marker-end', `url(#${markerId})`);

  return line;
}

function createLine(start: SvgPoint, end: SvgPoint, className: string): SVGLineElement {
  const line = createSvgElement('line');
  line.classList.add(className);
  line.setAttribute('x1', start.x.toFixed(2));
  line.setAttribute('y1', start.y.toFixed(2));
  line.setAttribute('x2', end.x.toFixed(2));
  line.setAttribute('y2', end.y.toFixed(2));

  return line;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}
