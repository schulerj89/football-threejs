import { describe, expect, it } from 'vitest';
import { createCenterSnapPlacement } from '../src/ballSpotting';
import { INITIAL_BALL_SPOT } from '../src/field';
import {
  createFootballToSvgTransform,
  createPlayCallDiagramModel,
  normalizeFootballSpotToSvg,
} from '../src/playCallDiagram';
import { getEligibleReceiverIds, getPlay, PLAYS } from '../src/playbook';

describe('play call diagrams', () => {
  it('creates one diagram model for every available offensive play', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const diagrams = PLAYS.map((play) => createPlayCallDiagramModel(play, snapPlacement));

    expect(diagrams).toHaveLength(PLAYS.length);
    expect(diagrams.map((diagram) => diagram.playName)).toEqual(
      PLAYS.map((play) => play.displayName),
    );
  });

  it('renders run plays with a run-direction arrow and blocker assignments', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const insideRun = createPlayCallDiagramModel(getPlay('inside-run'), snapPlacement);
    const outsideRun = createPlayCallDiagramModel(getPlay('outside-run'), snapPlacement);

    expect(insideRun.runDirection).not.toBeNull();
    expect(outsideRun.runDirection).not.toBeNull();
    expect(insideRun.receiverRoutes).toHaveLength(0);
    expect(outsideRun.blockerAssignments.length).toBeGreaterThanOrEqual(2);
    expect(outsideRun.runDirection?.end.x).toBeLessThan(insideRun.runDirection?.end.x ?? 0);
  });

  it('renders passing plays with one route per eligible receiver', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);

    for (const playId of ['quick-pass', 'slant-flat']) {
      const play = getPlay(playId);
      const diagram = createPlayCallDiagramModel(play, snapPlacement);

      expect(diagram.runDirection).toBeNull();
      expect(diagram.receiverRoutes).toHaveLength(getEligibleReceiverIds(play).length);
      expect(diagram.receiverRoutes.map((route) => route.receiverId)).toEqual(
        getEligibleReceiverIds(play),
      );
    }
  });

  it('mirrors pass-route directions to match the gameplay camera presentation', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const quickPass = createPlayCallDiagramModel(getPlay('quick-pass'), snapPlacement);
    const slantFlat = createPlayCallDiagramModel(getPlay('slant-flat'), snapPlacement);

    expect(quickPass.receiverRoutes[0].end.x).toBeGreaterThan(quickPass.receiverRoutes[0].start.x);
    expect(slantFlat.receiverRoutes[0].end.x).toBeGreaterThan(slantFlat.receiverRoutes[0].start.x);
    expect(slantFlat.receiverRoutes[1].end.x).toBeGreaterThan(slantFlat.receiverRoutes[1].start.x);
  });

  it('normalizes football coordinates into SVG coordinates with the defense above the line', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const transform = createFootballToSvgTransform(
      [
        INITIAL_BALL_SPOT,
        { x: 0, z: INITIAL_BALL_SPOT.z - 8 },
        { x: 0, z: INITIAL_BALL_SPOT.z + 10 },
      ],
      snapPlacement,
      { height: 100, width: 160 },
    );
    const linePoint = normalizeFootballSpotToSvg(INITIAL_BALL_SPOT, transform);
    const backfieldPoint = normalizeFootballSpotToSvg(
      { x: 0, z: INITIAL_BALL_SPOT.z - 8 },
      transform,
    );
    const downfieldPoint = normalizeFootballSpotToSvg(
      { x: 0, z: INITIAL_BALL_SPOT.z + 10 },
      transform,
    );

    expect(linePoint.x).toBeGreaterThan(0);
    expect(linePoint.y).toBeGreaterThan(0);
    expect(downfieldPoint.y).toBeLessThan(linePoint.y);
    expect(backfieldPoint.y).toBeGreaterThan(linePoint.y);
  });
});
