import { FOOTBALL_AUDIO_PLAN } from './audioPlan';
import { createAudioPlanReport, isDirectCli } from './schemas';

export function createFootballAudioReport() {
  return createAudioPlanReport(FOOTBALL_AUDIO_PLAN);
}

if (isDirectCli(import.meta.url)) {
  console.log(JSON.stringify(createFootballAudioReport(), null, 2));
}
