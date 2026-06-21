import {
  resolveFormation,
  type FormationValidationIssue,
  type ResolvedFormation,
  type ResolvedFormationSlot,
} from './formationLayout';
import type { GameplayModel } from './playState';

export function createFormationAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'formation-audit-overlay';
  document.body.appendChild(element);

  return element;
}

export function syncFormationAuditOverlay(
  element: HTMLDivElement,
  gameplay: GameplayModel,
  resolvedFormation?: ResolvedFormation,
): void {
  const formation = resolvedFormation ?? resolveFormation(gameplay.selectedPlay, {
    lane: gameplay.drive.snapLane,
    spot: gameplay.drive.lineOfScrimmage,
  });
  const invalidPlayerIds = new Set(
    formation.issues.flatMap((issue) => issue.playerIds),
  );
  const rows = [
    createRow('FORMATION AUDIT'),
    createRow(`PLAY ${resolvedFormation ? '7v7 Formation Preview' : gameplay.selectedPlay.displayName}`),
    createRow(`SNAP ${formation.snapPlacement.lane} ${formatSpot(formation.snapPlacement.spot)}`),
    createRow(`FIELD ${formation.fieldSide} BOUNDARY ${formation.boundarySide}`),
    createRow(`ISSUES ${formation.issues.length === 0 ? 'none' : formation.issues.length}`),
    ...formation.issues.map((issue) => createIssueRow(issue)),
    ...formation.slots.map((slot) => createSlotRow(slot, invalidPlayerIds.has(slot.id))),
  ];

  element.replaceChildren(...rows);
}

function createSlotRow(slot: ResolvedFormationSlot, invalid: boolean): HTMLDivElement {
  const row = createRow(
    `${slot.id} ${slot.team}/${slot.role} pos ${formatSpot(slot.position)} ` +
      `dx ${slot.lateralDistanceFromSnap.toFixed(1)} dz ${slot.distanceFromLineOfScrimmage.toFixed(1)} ` +
      `lat ${slot.lateral.kind} depth ${slot.longitudinal.side}:${slot.longitudinal.depthYards}`,
  );
  row.classList.toggle('invalid', invalid);

  return row;
}

function createIssueRow(issue: FormationValidationIssue): HTMLDivElement {
  const row = createRow(`! ${issue.message}`);
  row.classList.add('invalid');

  return row;
}

function createRow(text: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'formation-audit-row';
  row.textContent = text;

  return row;
}

function formatSpot(spot: { x: number; z: number }): string {
  return `${spot.x.toFixed(1)},${spot.z.toFixed(1)}`;
}
