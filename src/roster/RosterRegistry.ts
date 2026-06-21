import {
  createTeamRoster,
  validateTeamRoster,
  type StarterSeed,
  type TeamRoster,
} from './TeamRoster';

const METEORS_OFFENSE: readonly StarterSeed[] = [
  seed('QB', 12, 'Jalen', 'Carter', 'fieldGeneral'),
  seed('RB', 24, 'Miles', 'Redd', 'powerRunner'),
  seed('C', 55, 'Tomas', 'Vale', 'interiorAnchor'),
  seed('LG', 66, 'Caleb', 'Stone', 'interiorAnchor'),
  seed('RG', 72, 'Dante', 'Reed', 'interiorAnchor'),
  seed('LT', 75, 'Nolan', 'Brooks', 'interiorAnchor'),
  seed('RT', 78, 'Elias', 'Morrow', 'interiorAnchor'),
  seed('TE', 86, 'Andre', 'Knox', 'balancedReceiver'),
  seed('SLOT', 18, 'Quinn', 'Marsh', 'balancedReceiver'),
  seed('WR', 11, 'Silas', 'Cross', 'balancedReceiver'),
  seed('WR', 83, 'Theo', 'Lane', 'balancedReceiver'),
];
const METEORS_DEFENSE: readonly StarterSeed[] = [
  seed('DL', 90, 'Brock', 'Hale', 'edgeRusher'),
  seed('DL', 94, 'Oren', 'Black', 'interiorAnchor'),
  seed('DL', 97, 'Malik', 'West', 'edgeRusher'),
  seed('OLB', 41, 'Devon', 'Pierce', 'edgeRusher'),
  seed('OLB', 52, 'Jonah', 'Voss', 'edgeRusher'),
  seed('ILB', 47, 'Roman', 'Bishop', 'coverageSpecialist'),
  seed('ILB', 58, 'Asa', 'Grant', 'coverageSpecialist'),
  seed('CB', 21, 'Kyrie', 'Wells', 'coverageSpecialist'),
  seed('CB', 29, 'Micah', 'Fields', 'coverageSpecialist'),
  seed('FS', 31, 'Ezra', 'Moon', 'coverageSpecialist'),
  seed('SS', 36, 'Luca', 'Frost', 'coverageSpecialist'),
];

const LIGHTS_OFFENSE: readonly StarterSeed[] = [
  seed('QB', 8, 'Reid', 'Harper', 'accuratePasser'),
  seed('RB', 28, 'Kade', 'Lowell', 'powerRunner'),
  seed('C', 61, 'Mason', 'Duke', 'interiorAnchor'),
  seed('LG', 64, 'Arlo', 'Bennett', 'interiorAnchor'),
  seed('RG', 70, 'Ira', 'Sloan', 'interiorAnchor'),
  seed('LT', 73, 'Gavin', 'Shore', 'interiorAnchor'),
  seed('RT', 77, 'Leo', 'Bright', 'interiorAnchor'),
  seed('TE', 88, 'Cole', 'Rivers', 'balancedReceiver'),
  seed('SLOT', 16, 'Noah', 'Keene', 'balancedReceiver'),
  seed('WR', 10, 'Tariq', 'Noble', 'balancedReceiver'),
  seed('WR', 81, 'Jace', 'Summers', 'balancedReceiver'),
];
const LIGHTS_DEFENSE: readonly StarterSeed[] = [
  seed('DL', 91, 'Sol', 'Mercer', 'edgeRusher'),
  seed('DL', 93, 'Hugo', 'Vale', 'interiorAnchor'),
  seed('DL', 98, 'Dorian', 'Wade', 'edgeRusher'),
  seed('OLB', 42, 'Evan', 'North', 'edgeRusher'),
  seed('OLB', 53, 'Remy', 'Stone', 'edgeRusher'),
  seed('ILB', 45, 'Ari', 'Cline', 'coverageSpecialist'),
  seed('ILB', 57, 'Liam', 'Pryce', 'coverageSpecialist'),
  seed('CB', 22, 'Zane', 'Rook', 'coverageSpecialist'),
  seed('CB', 27, 'Omar', 'Hayes', 'coverageSpecialist'),
  seed('FS', 33, 'Nico', 'Fenn', 'coverageSpecialist'),
  seed('SS', 38, 'Eli', 'Page', 'coverageSpecialist'),
];

const FORGE_OFFENSE: readonly StarterSeed[] = [
  seed('QB', 14, 'Cyrus', 'Ward', 'fieldGeneral'),
  seed('RB', 23, 'Talon', 'Grey', 'powerRunner'),
  seed('C', 56, 'Mateo', 'Falk', 'interiorAnchor'),
  seed('LG', 67, 'Owen', 'Rhodes', 'interiorAnchor'),
  seed('RG', 71, 'Blaise', 'Miller', 'interiorAnchor'),
  seed('LT', 74, 'Wyatt', 'Keller', 'interiorAnchor'),
  seed('RT', 79, 'Simon', 'Ash', 'interiorAnchor'),
  seed('TE', 84, 'Rhett', 'Vale', 'balancedReceiver'),
  seed('SLOT', 19, 'Kai', 'Madden', 'balancedReceiver'),
  seed('WR', 13, 'Jude', 'Parks', 'balancedReceiver'),
  seed('WR', 82, 'Enzo', 'Lake', 'balancedReceiver'),
];
const FORGE_DEFENSE: readonly StarterSeed[] = [
  seed('DL', 92, 'Axel', 'Stone', 'edgeRusher'),
  seed('DL', 95, 'Bruno', 'Hayes', 'interiorAnchor'),
  seed('DL', 99, 'Koa', 'Sage', 'edgeRusher'),
  seed('OLB', 40, 'Dax', 'Foster', 'edgeRusher'),
  seed('OLB', 51, 'Nate', 'Irons', 'edgeRusher'),
  seed('ILB', 46, 'Trey', 'Marin', 'coverageSpecialist'),
  seed('ILB', 59, 'Alden', 'Fox', 'coverageSpecialist'),
  seed('CB', 20, 'Cruz', 'Vale', 'coverageSpecialist'),
  seed('CB', 26, 'Milo', 'Wynn', 'coverageSpecialist'),
  seed('FS', 32, 'Zion', 'Hart', 'coverageSpecialist'),
  seed('SS', 39, 'Rory', 'Cole', 'coverageSpecialist'),
];

const CURRENT_OFFENSE: readonly StarterSeed[] = [
  seed('QB', 6, 'Drew', 'Barton', 'accuratePasser'),
  seed('RB', 25, 'Ollie', 'Moss', 'powerRunner'),
  seed('C', 54, 'Tobin', 'Ray', 'interiorAnchor'),
  seed('LG', 63, 'Wes', 'Farrell', 'interiorAnchor'),
  seed('RG', 69, 'Ivan', 'Briar', 'interiorAnchor'),
  seed('LT', 76, 'Beck', 'Rowe', 'interiorAnchor'),
  seed('RT', 68, 'Jory', 'Wilde', 'interiorAnchor'),
  seed('TE', 85, 'Finn', 'Arden', 'balancedReceiver'),
  seed('SLOT', 17, 'Tyce', 'Banks', 'balancedReceiver'),
  seed('WR', 15, 'Rafe', 'Miles', 'balancedReceiver'),
  seed('WR', 80, 'Cian', 'Blake', 'balancedReceiver'),
];
const CURRENT_DEFENSE: readonly StarterSeed[] = [
  seed('DL', 90, 'Boone', 'Kane', 'edgeRusher'),
  seed('DL', 96, 'Marek', 'Cove', 'interiorAnchor'),
  seed('DL', 98, 'Joss', 'Knight', 'edgeRusher'),
  seed('OLB', 44, 'Levi', 'Mack', 'edgeRusher'),
  seed('OLB', 50, 'Rian', 'West', 'edgeRusher'),
  seed('ILB', 48, 'Ames', 'Ridge', 'coverageSpecialist'),
  seed('ILB', 56, 'Seth', 'Crowe', 'coverageSpecialist'),
  seed('CB', 21, 'Ilan', 'Drake', 'coverageSpecialist'),
  seed('CB', 30, 'Cade', 'Sutton', 'coverageSpecialist'),
  seed('FS', 34, 'Rex', 'Hollis', 'coverageSpecialist'),
  seed('SS', 37, 'Vaughn', 'Pierce', 'coverageSpecialist'),
];

const SPECIALISTS: readonly StarterSeed[] = [
  seed('K', 5, 'Pax', 'Bly', 'specialist'),
  seed('P', 9, 'Hale', 'Quinn', 'specialist'),
];

export const STARTER_TEAM_ROSTERS: readonly TeamRoster[] = [
  createTeamRoster('metro-meteors', METEORS_OFFENSE, METEORS_DEFENSE, SPECIALISTS),
  createTeamRoster('lakefront-lights', LIGHTS_OFFENSE, LIGHTS_DEFENSE, SPECIALISTS),
  createTeamRoster('summit-forge', FORGE_OFFENSE, FORGE_DEFENSE, SPECIALISTS),
  createTeamRoster('bay-city-current', CURRENT_OFFENSE, CURRENT_DEFENSE, SPECIALISTS),
] as const;

export function listTeamRosters(): TeamRoster[] {
  return STARTER_TEAM_ROSTERS.map(cloneTeamRoster);
}

export function getTeamRoster(teamId: string): TeamRoster | null {
  const roster = STARTER_TEAM_ROSTERS.find((candidate) => candidate.teamId === teamId);
  return roster ? cloneTeamRoster(roster) : null;
}

export function getTeamRosterOrDefault(teamId: string): TeamRoster {
  return getTeamRoster(teamId) ?? cloneTeamRoster(STARTER_TEAM_ROSTERS[0]);
}

export function validateStarterTeamRosters(): ReturnType<typeof validateTeamRoster>[] {
  return STARTER_TEAM_ROSTERS.map(validateTeamRoster);
}

function cloneTeamRoster(roster: TeamRoster): TeamRoster {
  return {
    defensiveStarterIds: [...roster.defensiveStarterIds],
    kickerId: roster.kickerId,
    offensiveStarterIds: [...roster.offensiveStarterIds],
    players: roster.players.map((player) => ({ ...player })),
    punterId: roster.punterId,
    teamId: roster.teamId,
  };
}

function seed(
  position: StarterSeed['position'],
  jerseyNumber: number,
  firstName: string,
  lastName: string,
  archetype: StarterSeed['archetype'],
): StarterSeed {
  return {
    archetype,
    firstName,
    jerseyNumber,
    lastName,
    position,
  };
}
