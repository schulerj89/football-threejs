import type { PregameCommentarySelection } from '../../audio/PregameCommentaryCatalog';
import type { PregameLowerThirdState } from './PregamePresentationTypes';
import type { QuarterbackSpotlightSubject } from './SpotlightSubjectResolver';

export function createPlayerSpotlightLowerThirdState(
  subject: QuarterbackSpotlightSubject,
  selection: PregameCommentarySelection | null,
): PregameLowerThirdState {
  return {
    abbreviation: String(subject.jerseyNumber),
    accentColor: subject.teamAccentColor,
    caption: selection?.caption ?? null,
    detail: `${subject.footballPosition} - ${subject.teamAbbreviation || subject.teamName}`,
    displayName: subject.formattedName,
    visible: true,
  };
}
