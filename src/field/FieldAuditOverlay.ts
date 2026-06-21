import {
  FIELD_BOUNDS,
  INNER_MARKING_BOUNDS,
  createFieldLayout,
  validateFieldLayout,
} from '../fieldSpec';

export function createFieldAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'field-audit-overlay';
  document.body.append(element);
  syncFieldAuditOverlay(element);
  return element;
}

export function syncFieldAuditOverlay(element: HTMLElement): void {
  const layout = createFieldLayout();
  const issues = validateFieldLayout(layout);
  const markingCounts = layout.markings.reduce<Record<string, number>>((counts, marking) => {
    counts[marking.kind] = (counts[marking.kind] ?? 0) + 1;
    return counts;
  }, {});

  element.textContent = [
    'FIELD AUDIT',
    `FIELD ${formatBounds(FIELD_BOUNDS)}`,
    `INNER ${formatBounds(INNER_MARKING_BOUNDS)}`,
    `PLAYABLE ${formatBounds(layout.playableBounds)}`,
    `MARKINGS ${layout.markings.length}`,
    `COUNTS ${Object.entries(markingCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, count]) => `${kind}:${count}`)
      .join(' ')}`,
    `ISSUES ${issues.length === 0 ? 'none' : issues.length}`,
    ...issues.map((issue) => `! ${issue.id} ${formatBounds(issue.bounds)}`),
    'Scene helpers: use ?fieldAudit=1 for visual bounds/corner markers.',
  ].join('\n');
}

function formatBounds(bounds: {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}): string {
  return `${bounds.minX.toFixed(2)},${bounds.minZ.toFixed(2)} to ` +
    `${bounds.maxX.toFixed(2)},${bounds.maxZ.toFixed(2)}`;
}
