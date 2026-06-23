import {
  createTeamRoster,
  validateTeamRoster,
  type StarterSeed,
  type TeamRoster,
} from './TeamRoster';
import { clonePlayerRatings } from '../ratings/PlayerRatings';

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

const METEORS_SPECIALISTS: readonly StarterSeed[] = [
  seed('K', 5, 'Pax', 'Bly', 'specialist'),
  seed('P', 9, 'Hale', 'Quinn', 'specialist'),
  seed('LS', 49, 'Otis', 'Reeve', 'specialist'),
  seed('RB', 2, 'Makai', 'Swift', 'utility'),
  seed('WR', 7, 'Evan', 'Blair', 'balancedReceiver'),
  seed('CB', 34, 'Rico', 'Hayden', 'coverageSpecialist'),
  seed('OLB', 43, 'Taj', 'Morris', 'edgeRusher'),
  seed('DL', 60, 'Gabe', 'Sutter', 'interiorAnchor'),
  seed('TE', 87, 'Drew', 'Holt', 'balancedReceiver'),
  seed('WR', 89, 'Nico', 'Price', 'balancedReceiver'),
];

const LIGHTS_SPECIALISTS: readonly StarterSeed[] = [
  seed('K', 5, 'Milo', 'Vega', 'specialist'),
  seed('P', 9, 'Bram', 'Ellis', 'specialist'),
  seed('LS', 49, 'Wyatt', 'Cove', 'specialist'),
  seed('RB', 3, 'Trey', 'Landon', 'utility'),
  seed('WR', 7, 'Kian', 'Ross', 'balancedReceiver'),
  seed('CB', 35, 'Jett', 'Rowan', 'coverageSpecialist'),
  seed('OLB', 44, 'Cory', 'Nash', 'edgeRusher'),
  seed('DL', 60, 'Omar', 'Bex', 'interiorAnchor'),
  seed('TE', 84, 'Finn', 'Mercer', 'balancedReceiver'),
  seed('WR', 89, 'Rylan', 'Gray', 'balancedReceiver'),
];

const FORGE_SPECIALISTS: readonly StarterSeed[] = [
  seed('K', 5, 'Sage', 'Nolan', 'specialist'),
  seed('P', 9, 'Crew', 'Barrett', 'specialist'),
  seed('LS', 49, 'Lyle', 'Brock', 'specialist'),
  seed('RB', 2, 'Mace', 'Davis', 'utility'),
  seed('WR', 7, 'Kellen', 'Ames', 'balancedReceiver'),
  seed('CB', 34, 'Nash', 'Ives', 'coverageSpecialist'),
  seed('OLB', 43, 'Rook', 'Tanner', 'edgeRusher'),
  seed('DL', 60, 'Hank', 'Alder', 'interiorAnchor'),
  seed('TE', 86, 'Vince', 'Ridge', 'balancedReceiver'),
  seed('WR', 88, 'Lio', 'Grant', 'balancedReceiver'),
];

const CURRENT_SPECIALISTS: readonly StarterSeed[] = [
  seed('K', 5, 'Piers', 'Vale', 'specialist'),
  seed('P', 9, 'Lane', 'Oakes', 'specialist'),
  seed('LS', 49, 'Merrick', 'Shaw', 'specialist'),
  seed('RB', 2, 'Dane', 'Frost', 'utility'),
  seed('WR', 7, 'Remy', 'Vale', 'balancedReceiver'),
  seed('CB', 35, 'Jules', 'Briar', 'coverageSpecialist'),
  seed('OLB', 43, 'Tate', 'Harlow', 'edgeRusher'),
  seed('DL', 60, 'Arden', 'Knox', 'interiorAnchor'),
  seed('TE', 86, 'Reese', 'Caldwell', 'balancedReceiver'),
  seed('WR', 88, 'Soren', 'Pike', 'balancedReceiver'),
];

const OWLS_OFFENSE: readonly StarterSeed[] = [
  seed('QB', 4, 'Maren', 'Kade', 'fieldGeneral'),
  seed('RB', 27, 'Briar', 'Ellis', 'powerRunner'),
  seed('C', 57, 'Graham', 'Toll', 'interiorAnchor'),
  seed('LG', 65, 'Oskar', 'Wells', 'interiorAnchor'),
  seed('RG', 73, 'Bennett', 'Marsh', 'interiorAnchor'),
  seed('LT', 76, 'Rowan', 'Greer', 'interiorAnchor'),
  seed('RT', 79, 'Silas', 'Holt', 'interiorAnchor'),
  seed('TE', 87, 'Gideon', 'Pine', 'balancedReceiver'),
  seed('SLOT', 18, 'Emery', 'Fox', 'balancedReceiver'),
  seed('WR', 12, 'Landon', 'Rusk', 'balancedReceiver'),
  seed('WR', 82, 'Noel', 'Bram', 'balancedReceiver'),
];
const OWLS_DEFENSE: readonly StarterSeed[] = [
  seed('DL', 91, 'Alder', 'Voss', 'interiorAnchor'),
  seed('DL', 95, 'Thane', 'Cedar', 'interiorAnchor'),
  seed('DL', 98, 'Kellan', 'Ridge', 'edgeRusher'),
  seed('OLB', 40, 'Orin', 'Pace', 'edgeRusher'),
  seed('OLB', 52, 'Maddox', 'Reeve', 'edgeRusher'),
  seed('ILB', 46, 'Stellan', 'Moss', 'coverageSpecialist'),
  seed('ILB', 58, 'Drew', 'Rook', 'coverageSpecialist'),
  seed('CB', 21, 'Cai', 'Merrin', 'coverageSpecialist'),
  seed('CB', 30, 'Iver', 'Stone', 'coverageSpecialist'),
  seed('FS', 33, 'Soren', 'Vale', 'coverageSpecialist'),
  seed('SS', 38, 'Nico', 'Branch', 'coverageSpecialist'),
];

const SCORPIONS_OFFENSE: readonly StarterSeed[] = [
  seed('QB', 3, 'Kai', 'Navarro', 'accuratePasser'),
  seed('RB', 22, 'Rafa', 'Sands', 'powerRunner'),
  seed('C', 56, 'Marco', 'Vega', 'interiorAnchor'),
  seed('LG', 64, 'Tomas', 'Flint', 'interiorAnchor'),
  seed('RG', 70, 'Dario', 'Kline', 'interiorAnchor'),
  seed('LT', 74, 'Luca', 'Mesa', 'interiorAnchor'),
  seed('RT', 77, 'Joaquin', 'Slate', 'interiorAnchor'),
  seed('TE', 85, 'Mateo', 'Ridge', 'balancedReceiver'),
  seed('SLOT', 19, 'Cruz', 'Sol', 'balancedReceiver'),
  seed('WR', 10, 'Zev', 'Arroyo', 'balancedReceiver'),
  seed('WR', 81, 'Nash', 'Canyon', 'balancedReceiver'),
];
const SCORPIONS_DEFENSE: readonly StarterSeed[] = [
  seed('DL', 90, 'Rex', 'Voss', 'edgeRusher'),
  seed('DL', 94, 'Nolan', 'Dune', 'interiorAnchor'),
  seed('DL', 99, 'Mace', 'Bishop', 'edgeRusher'),
  seed('OLB', 41, 'Dante', 'Rios', 'edgeRusher'),
  seed('OLB', 53, 'Jett', 'Vance', 'edgeRusher'),
  seed('ILB', 47, 'Ishan', 'Vale', 'coverageSpecialist'),
  seed('ILB', 59, 'Theo', 'Ash', 'coverageSpecialist'),
  seed('CB', 20, 'Remy', 'Quill', 'coverageSpecialist'),
  seed('CB', 28, 'Omar', 'Cade', 'coverageSpecialist'),
  seed('FS', 32, 'Milo', 'Drax', 'coverageSpecialist'),
  seed('SS', 37, 'Ezra', 'Knox', 'coverageSpecialist'),
];

const OWLS_SPECIALISTS: readonly StarterSeed[] = [
  seed('K', 5, 'Theo', 'Bly', 'specialist'),
  seed('P', 9, 'Cal', 'Morrow', 'specialist'),
  seed('LS', 49, 'Felix', 'Ames', 'specialist'),
  seed('RB', 2, 'Jalen', 'Quick', 'utility'),
  seed('WR', 7, 'Mika', 'Hale', 'balancedReceiver'),
  seed('CB', 34, 'Reid', 'Harrow', 'coverageSpecialist'),
  seed('OLB', 43, 'Kade', 'Pierce', 'edgeRusher'),
  seed('DL', 60, 'Tobin', 'North', 'interiorAnchor'),
  seed('TE', 84, 'Evan', 'Wilde', 'balancedReceiver'),
  seed('WR', 89, 'Asa', 'Fenn', 'balancedReceiver'),
];

const SCORPIONS_SPECIALISTS: readonly StarterSeed[] = [
  seed('K', 5, 'Pax', 'Duran', 'specialist'),
  seed('P', 9, 'Bram', 'Soto', 'specialist'),
  seed('LS', 49, 'Hugo', 'Reyes', 'specialist'),
  seed('RB', 2, 'Taj', 'Miles', 'utility'),
  seed('WR', 7, 'Kian', 'Rook', 'balancedReceiver'),
  seed('CB', 34, 'Zane', 'Vale', 'coverageSpecialist'),
  seed('OLB', 43, 'Cory', 'West', 'edgeRusher'),
  seed('DL', 60, 'Gabe', 'Frost', 'interiorAnchor'),
  seed('TE', 86, 'Rylan', 'Banks', 'balancedReceiver'),
  seed('WR', 88, 'Finn', 'Pike', 'balancedReceiver'),
];

export const STARTER_TEAM_ROSTERS: readonly TeamRoster[] = [
  createTeamRoster('metro-meteors', METEORS_OFFENSE, METEORS_DEFENSE, METEORS_SPECIALISTS),
  createTeamRoster('lakefront-lights', LIGHTS_OFFENSE, LIGHTS_DEFENSE, LIGHTS_SPECIALISTS),
  createTeamRoster('summit-forge', FORGE_OFFENSE, FORGE_DEFENSE, FORGE_SPECIALISTS),
  createTeamRoster('bay-city-current', CURRENT_OFFENSE, CURRENT_DEFENSE, CURRENT_SPECIALISTS),
  createTeamRoster('ironwood-owls', OWLS_OFFENSE, OWLS_DEFENSE, OWLS_SPECIALISTS),
  createTeamRoster('desert-ridge-scorpions', SCORPIONS_OFFENSE, SCORPIONS_DEFENSE, SCORPIONS_SPECIALISTS),
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
    longSnapperId: roster.longSnapperId,
    offensiveStarterIds: [...roster.offensiveStarterIds],
    players: roster.players.map((player) => ({
      ...player,
      ...(player.kickerRatings ? { kickerRatings: { ...player.kickerRatings } } : {}),
      ratings: clonePlayerRatings(player.ratings),
    })),
    punterId: roster.punterId,
    reserveIds: [...roster.reserveIds],
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
