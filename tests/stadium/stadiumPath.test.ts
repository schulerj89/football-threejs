import { describe, expect, it } from 'vitest';
import { DEFAULT_STADIUM_SPEC } from '../../src/stadium/StadiumSpec';
import { createStadiumRows } from '../../src/stadium/StadiumLayout';
import {
  createStadiumPath,
  isPathContinuous,
  samplePathAtDistance,
  sectionLength,
} from '../../src/stadium/StadiumPath';

describe('stadium path and row math', () => {
  it('constructs connected rounded-rectangle path segments', () => {
    const path = createStadiumPath(DEFAULT_STADIUM_SPEC);

    expect(path.segments).toHaveLength(8);
    expect(isPathContinuous(path)).toBe(true);
    expect(path.perimeterLength).toBeGreaterThan(0);
    for (const segment of path.segments) {
      expect(segment.length).toBeGreaterThan(0);
    }
  });

  it('keeps opposite straight stands mathematically symmetrical', () => {
    const spec = DEFAULT_STADIUM_SPEC;
    expect(sectionLength('sidelineLeft', spec)).toBeCloseTo(sectionLength('sidelineRight', spec), 6);
    expect(sectionLength('endZoneNear', spec)).toBeCloseTo(sectionLength('endZoneFar', spec), 6);

    const path = createStadiumPath(spec);
    const left = path.segments.find((segment) => segment.id === 'sidelineLeft')!;
    const right = path.segments.find((segment) => segment.id === 'sidelineRight')!;
    const near = path.segments.find((segment) => segment.id === 'endZoneNear')!;
    const far = path.segments.find((segment) => segment.id === 'endZoneFar')!;

    expect(left.start.x).toBeCloseTo(-right.end.x, 6);
    expect(left.end.x).toBeCloseTo(-right.start.x, 6);
    expect(near.start.z).toBeCloseTo(-far.end.z, 6);
    expect(near.end.z).toBeCloseTo(-far.start.z, 6);
  });

  it('samples each section with normalized tangent and outward normal data', () => {
    const spec = DEFAULT_STADIUM_SPEC;
    const path = createStadiumPath(spec);

    for (const segment of path.segments) {
      const sample = samplePathAtDistance(path, segment.startDistance + segment.length / 2, spec);
      expect(sample.sectionId).toBe(segment.id);
      expect(Math.hypot(sample.tangent.x, sample.tangent.z)).toBeCloseTo(1, 6);
      expect(Math.hypot(sample.normal.x, sample.normal.z)).toBeCloseTo(1, 6);
      expect(Math.abs(sample.tangent.x * sample.normal.x + sample.tangent.z * sample.normal.z))
        .toBeLessThan(1e-6);
    }
  });

  it('generates rows from constant depth and rise formulas', () => {
    const spec = DEFAULT_STADIUM_SPEC;
    const rows = createStadiumRows(spec, true);
    const lowerRows = rows.filter((row) => row.tier === 0);
    const upperRows = rows.filter((row) => row.tier === 1);

    expect(lowerRows).toHaveLength(spec.tiers[0].rowCount);
    expect(upperRows).toHaveLength(spec.tiers[1].rowCount);

    for (const tierRows of [lowerRows, upperRows]) {
      for (let index = 1; index < tierRows.length; index += 1) {
        expect(tierRows[index].offset - tierRows[index - 1].offset).toBeCloseTo(spec.rowDepth, 6);
        expect(tierRows[index].elevation - tierRows[index - 1].elevation).toBeCloseTo(spec.rowRise, 6);
      }
    }
  });
});
