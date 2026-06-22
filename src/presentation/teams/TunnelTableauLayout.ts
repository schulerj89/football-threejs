import { DEFAULT_STADIUM_SPEC } from '../../stadium/StadiumSpec';
import {
  createStadiumPath,
  offsetPathSample,
  samplePathAtDistance,
} from '../../stadium/StadiumPath';
import type {
  StadiumSpec,
  StadiumTunnelSpec,
} from '../../stadium/StadiumTypes';
import type {
  SidelineTeamSide,
  SidelineVec3,
} from './SidelineTeamTypes';

export interface TunnelAnchor {
  facingRadians: number;
  position: SidelineVec3;
  sectionId: StadiumTunnelSpec['sectionId'];
  tunnelId: string;
}

export function resolveTunnelAnchor(
  teamSide: SidelineTeamSide,
  spec: StadiumSpec = DEFAULT_STADIUM_SPEC,
): TunnelAnchor {
  const sectionId = teamSide === 'user' ? 'sidelineLeft' : 'sidelineRight';
  const tunnel = selectTunnel(teamSide, spec);
  const path = createStadiumPath(spec);
  const segment = path.segments.find((candidate) => candidate.id === sectionId);
  if (!segment || !tunnel) {
    return createFallbackTunnelAnchor(teamSide, spec);
  }

  const sample = samplePathAtDistance(
    path,
    segment.startDistance + tunnel.centerDistanceAlongSection,
    spec,
  );
  const offset = offsetPathSample(sample, spec.rowDepth * 1.6);
  const inward = {
    x: -sample.normal.x,
    z: -sample.normal.z,
  };

  return {
    facingRadians: Math.atan2(inward.x, inward.z),
    position: {
      x: offset.x,
      y: 0,
      z: offset.z,
    },
    sectionId,
    tunnelId: tunnel.id,
  };
}

function selectTunnel(
  teamSide: SidelineTeamSide,
  spec: StadiumSpec,
): StadiumTunnelSpec | null {
  const sectionId = teamSide === 'user' ? 'sidelineLeft' : 'sidelineRight';
  const candidates = spec.tunnels.filter((tunnel) => tunnel.sectionId === sectionId);
  if (candidates.length === 0) {
    return null;
  }
  return teamSide === 'user' ? candidates[0] : candidates[candidates.length - 1];
}

function createFallbackTunnelAnchor(
  teamSide: SidelineTeamSide,
  spec: StadiumSpec,
): TunnelAnchor {
  const xSign = teamSide === 'user' ? -1 : 1;
  return {
    facingRadians: Math.atan2(-xSign, 0),
    position: {
      x: xSign * (spec.innerBowlWidth / 2 + spec.rowDepth),
      y: 0,
      z: teamSide === 'user' ? -24 : 24,
    },
    sectionId: teamSide === 'user' ? 'sidelineLeft' : 'sidelineRight',
    tunnelId: `${teamSide}-fallback-tunnel`,
  };
}
