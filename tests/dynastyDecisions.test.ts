import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DYNASTY_DECISION_DOC_PATH } from '../src/ui/FootballHubScreen';

describe('dynasty decision roadmap', () => {
  it('marks the first dynasty phase complete and keeps the hub shell pointed at the decision map', () => {
    const decisionDoc = readFileSync(DYNASTY_DECISION_DOC_PATH, 'utf8');

    expect(DYNASTY_DECISION_DOC_PATH).toBe('docs/DYNASTY_DECISIONS.md');
    expect(decisionDoc).toContain('### Phase 0: Dynasty Shell');
    expect(decisionDoc).toContain('Status: Complete in `1.22.0`.');
    expect(decisionDoc).toContain('The Dynasty destination is a non-playable planning shell.');
  });
});
