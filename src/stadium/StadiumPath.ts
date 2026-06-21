import { DEFAULT_STADIUM_SPEC } from './StadiumSpec';
import type {
  StadiumPath,
  StadiumPathSample,
  StadiumPathSegment,
  StadiumSectionId,
  StadiumSpec,
  Vec2,
} from './StadiumTypes';

interface RawLineSegment {
  end: Vec2;
  id: StadiumSectionId;
  length: number;
  normal: Vec2;
  start: Vec2;
  tangent: Vec2;
  type: 'line';
}

interface RawArcSegment {
  center: Vec2;
  endAngle: number;
  id: StadiumSectionId;
  length: number;
  radius: number;
  startAngle: number;
  type: 'arc';
}

type RawSegment = RawArcSegment | RawLineSegment;

const TWO_PI = Math.PI * 2;

export function createStadiumPath(spec: StadiumSpec = DEFAULT_STADIUM_SPEC): StadiumPath {
  const halfWidth = spec.innerBowlWidth / 2;
  const halfDepth = spec.innerBowlDepth / 2;
  const radius = spec.cornerRadius;
  const straightDepth = spec.innerBowlDepth - radius * 2;
  const straightWidth = spec.innerBowlWidth - radius * 2;

  if (straightDepth <= 0 || straightWidth <= 0) {
    throw new Error('Stadium corner radius is too large for the inner bowl dimensions.');
  }

  const rawSegments: RawSegment[] = [
    {
      end: { x: halfWidth, z: halfDepth - radius },
      id: 'sidelineRight',
      length: straightDepth,
      normal: { x: 1, z: 0 },
      start: { x: halfWidth, z: -halfDepth + radius },
      tangent: { x: 0, z: 1 },
      type: 'line',
    },
    {
      center: { x: halfWidth - radius, z: halfDepth - radius },
      endAngle: Math.PI / 2,
      id: 'cornerFarRight',
      length: radius * Math.PI / 2,
      radius,
      startAngle: 0,
      type: 'arc',
    },
    {
      end: { x: -halfWidth + radius, z: halfDepth },
      id: 'endZoneFar',
      length: straightWidth,
      normal: { x: 0, z: 1 },
      start: { x: halfWidth - radius, z: halfDepth },
      tangent: { x: -1, z: 0 },
      type: 'line',
    },
    {
      center: { x: -halfWidth + radius, z: halfDepth - radius },
      endAngle: Math.PI,
      id: 'cornerFarLeft',
      length: radius * Math.PI / 2,
      radius,
      startAngle: Math.PI / 2,
      type: 'arc',
    },
    {
      end: { x: -halfWidth, z: -halfDepth + radius },
      id: 'sidelineLeft',
      length: straightDepth,
      normal: { x: -1, z: 0 },
      start: { x: -halfWidth, z: halfDepth - radius },
      tangent: { x: 0, z: -1 },
      type: 'line',
    },
    {
      center: { x: -halfWidth + radius, z: -halfDepth + radius },
      endAngle: Math.PI * 1.5,
      id: 'cornerNearLeft',
      length: radius * Math.PI / 2,
      radius,
      startAngle: Math.PI,
      type: 'arc',
    },
    {
      end: { x: halfWidth - radius, z: -halfDepth },
      id: 'endZoneNear',
      length: straightWidth,
      normal: { x: 0, z: -1 },
      start: { x: -halfWidth + radius, z: -halfDepth },
      tangent: { x: 1, z: 0 },
      type: 'line',
    },
    {
      center: { x: halfWidth - radius, z: -halfDepth + radius },
      endAngle: TWO_PI,
      id: 'cornerNearRight',
      length: radius * Math.PI / 2,
      radius,
      startAngle: Math.PI * 1.5,
      type: 'arc',
    },
  ];

  let startDistance = 0;
  const segments: StadiumPathSegment[] = rawSegments.map((segment) => {
    const start = segment.type === 'line'
      ? segment.start
      : pointOnArc(segment.center, segment.radius, segment.startAngle);
    const end = segment.type === 'line'
      ? segment.end
      : pointOnArc(segment.center, segment.radius, segment.endAngle);
    const output: StadiumPathSegment = {
      end,
      id: segment.id,
      length: segment.length,
      start,
      startDistance,
      type: segment.type,
    };
    startDistance += segment.length;
    return output;
  });

  return {
    halfDepth,
    halfWidth,
    perimeterLength: startDistance,
    segments,
  };
}

export function sampleStadiumPath(
  distance: number,
  spec: StadiumSpec = DEFAULT_STADIUM_SPEC,
): StadiumPathSample {
  const path = createStadiumPath(spec);
  return samplePathAtDistance(path, distance, spec);
}

export function samplePathAtDistance(
  path: StadiumPath,
  distance: number,
  spec: StadiumSpec = DEFAULT_STADIUM_SPEC,
): StadiumPathSample {
  const wrappedDistance = wrapDistance(distance, path.perimeterLength);
  const segment =
    [...path.segments].reverse().find((candidate) =>
      wrappedDistance >= candidate.startDistance - 1e-9) ?? path.segments[0];
  const distanceAlongSection = Math.min(
    segment.length,
    Math.max(0, wrappedDistance - segment.startDistance),
  );

  if (segment.type === 'line') {
    const t = segment.length > 0 ? distanceAlongSection / segment.length : 0;
    const tangent = normalize({
      x: segment.end.x - segment.start.x,
      z: segment.end.z - segment.start.z,
    });
    return {
      center: lerpPoint(segment.start, segment.end, t),
      distanceAlongPath: wrappedDistance,
      distanceAlongSection,
      normal: lineNormal(segment.id),
      sectionId: segment.id,
      tangent,
    };
  }

  const radius = spec.cornerRadius;
  const arc = resolveArc(segment.id, spec);
  const angle = arc.startAngle + distanceAlongSection / radius;
  const normal = normalize({
    x: Math.cos(angle),
    z: Math.sin(angle),
  });
  return {
    center: pointOnArc(arc.center, radius, angle),
    distanceAlongPath: wrappedDistance,
    distanceAlongSection,
    normal,
    sectionId: segment.id,
    tangent: normalize({
      x: -Math.sin(angle),
      z: Math.cos(angle),
    }),
  };
}

export function offsetPathSample(sample: StadiumPathSample, offset: number): Vec2 {
  return {
    x: sample.center.x + sample.normal.x * offset,
    z: sample.center.z + sample.normal.z * offset,
  };
}

export function sectionLength(sectionId: StadiumSectionId, spec = DEFAULT_STADIUM_SPEC): number {
  const path = createStadiumPath(spec);
  return path.segments.find((segment) => segment.id === sectionId)?.length ?? 0;
}

export function isPathContinuous(path: StadiumPath, tolerance = 1e-6): boolean {
  return path.segments.every((segment, index) => {
    const next = path.segments[(index + 1) % path.segments.length];
    return Math.hypot(segment.end.x - next.start.x, segment.end.z - next.start.z) <= tolerance;
  });
}

function resolveArc(sectionId: StadiumSectionId, spec: StadiumSpec): {
  center: Vec2;
  startAngle: number;
} {
  const halfWidth = spec.innerBowlWidth / 2;
  const halfDepth = spec.innerBowlDepth / 2;
  const radius = spec.cornerRadius;

  if (sectionId === 'cornerFarRight') {
    return {
      center: { x: halfWidth - radius, z: halfDepth - radius },
      startAngle: 0,
    };
  }
  if (sectionId === 'cornerFarLeft') {
    return {
      center: { x: -halfWidth + radius, z: halfDepth - radius },
      startAngle: Math.PI / 2,
    };
  }
  if (sectionId === 'cornerNearLeft') {
    return {
      center: { x: -halfWidth + radius, z: -halfDepth + radius },
      startAngle: Math.PI,
    };
  }
  return {
    center: { x: halfWidth - radius, z: -halfDepth + radius },
    startAngle: Math.PI * 1.5,
  };
}

function lineNormal(sectionId: StadiumSectionId): Vec2 {
  if (sectionId === 'sidelineLeft') {
    return { x: -1, z: 0 };
  }
  if (sectionId === 'sidelineRight') {
    return { x: 1, z: 0 };
  }
  if (sectionId === 'endZoneFar') {
    return { x: 0, z: 1 };
  }
  if (sectionId === 'endZoneNear') {
    return { x: 0, z: -1 };
  }
  return { x: 0, z: 0 };
}

function pointOnArc(center: Vec2, radius: number, angle: number): Vec2 {
  return {
    x: center.x + Math.cos(angle) * radius,
    z: center.z + Math.sin(angle) * radius,
  };
}

function lerpPoint(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.z);
  if (length <= 1e-9) {
    return { x: 0, z: 0 };
  }
  return {
    x: vector.x / length,
    z: vector.z / length,
  };
}

function wrapDistance(distance: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((distance % length) + length) % length;
}
