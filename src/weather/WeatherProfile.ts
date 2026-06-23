import type { WeatherProfile, WeatherSnapshot } from './WeatherTypes';

export const CLEAR_WEATHER_PROFILE: WeatherProfile = {
  id: 'clear',
  lighting: {
    hemisphereGroundColor: 0x33443a,
    hemisphereIntensity: 2.15,
    hemisphereSkyColor: 0xddeeff,
    keyLightColor: 0xfff1c8,
    keyLightIntensity: 2.35,
  },
  sky: {
    horizonColor: 0xb8dcff,
    overheadColor: 0x1c64b7,
    radius: 420,
    sunColor: 0xfff4bb,
    sunDiscRadius: 9,
    sunDistance: 330,
    sunGlowColor: 0xffd98a,
    sunGlowRadius: 20,
  },
  snapshot: {
    cloudiness: 0,
    condition: 'clear',
    precipitation: 0,
    sunAzimuthRadians: -2.25,
    sunElevationRadians: 0.82,
    windDirectionRadians: 0.35,
    windSpeedMph: 4,
  },
} as const;

export function createClearWeatherSnapshot(): WeatherSnapshot {
  return cloneWeatherSnapshot(CLEAR_WEATHER_PROFILE.snapshot);
}

export function cloneWeatherSnapshot(snapshot: WeatherSnapshot): WeatherSnapshot {
  return {
    cloudiness: snapshot.cloudiness,
    condition: snapshot.condition,
    precipitation: snapshot.precipitation,
    sunAzimuthRadians: snapshot.sunAzimuthRadians,
    sunElevationRadians: snapshot.sunElevationRadians,
    windDirectionRadians: snapshot.windDirectionRadians,
    windSpeedMph: snapshot.windSpeedMph,
  };
}
