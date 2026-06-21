import type { PassAuditSnapshot } from './playState';

export function createPassAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'pass-audit-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncPassAuditOverlay(
  element: HTMLElement,
  snapshot: PassAuditSnapshot | null,
): void {
  if (!snapshot) {
    element.textContent = 'PASS AUDIT\nno active pass';
    return;
  }

  element.textContent = [
    'PASS AUDIT',
    `TARGET ${snapshot.selectedReceiverId}`,
    `RELEASE ${formatVector(snapshot.releasePosition)}`,
    `PRED_TARGET ${formatVector(snapshot.predictedTargetPosition)}`,
    `PRED_RECEIVER ${formatSpot(snapshot.predictedReceiverPosition)}`,
    `PRED_ROUTE ${snapshot.predictedReceiverRouteDistance.toFixed(2)} yd`,
    `PRED_FLIGHT ${snapshot.predictedFlightSeconds.toFixed(3)} s`,
    `CLOSEST_BALL ${formatVector(snapshot.actualClosestApproach?.ball ?? null)}`,
    `CLOSEST_RECEIVER ${formatSpot(snapshot.actualClosestApproach?.receiver ?? null)}`,
    `MISS ${formatNullable(snapshot.horizontalMissDistance, ' yd')}`,
    `HEIGHT ${formatNullable(snapshot.ballHeightAtClosestApproach, ' yd')}`,
    `REASON ${snapshot.resultReason}`,
  ].join('\n');
}

function formatVector(vector: { x: number; y: number; z: number } | null): string {
  if (!vector) {
    return 'none';
  }

  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function formatSpot(spot: { x: number; z: number } | null): string {
  if (!spot) {
    return 'none';
  }

  return `${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}`;
}

function formatNullable(value: number | null, suffix = ''): string {
  if (value === null) {
    return 'none';
  }

  return `${value.toFixed(2)}${suffix}`;
}
