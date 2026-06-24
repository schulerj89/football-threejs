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
    sunColor: 0xffffd6,
    sunDiscRadius: 16,
    sunDistance: 330,
    sunGlowColor: 0xffd488,
    sunGlowRadius: 42,
    sunVisible: true,
  },
  snapshot: {
    cloudiness: 0,
    condition: 'clear',
    precipitation: 0,
    sunAzimuthRadians: 1.32,
    sunElevationRadians: 0.04,
    windDirectionRadians: 0.35,
    windSpeedMph: 4,
  },
} as const;

export const OVERCAST_WEATHER_PROFILE: WeatherProfile = {
  id: 'overcast',
  lighting: {
    hemisphereGroundColor: 0x3f4648,
    hemisphereIntensity: 1.8,
    hemisphereSkyColor: 0xb8c0c4,
    keyLightColor: 0xd4d8d8,
    keyLightIntensity: 1.25,
  },
  sky: {
    horizonColor: 0x9aa2a6,
    overheadColor: 0x5f686e,
    radius: 420,
    sunColor: 0xe5e3d7,
    sunDiscRadius: 10,
    sunDistance: 330,
    sunGlowColor: 0xc7c3b4,
    sunGlowRadius: 56,
    sunVisible: false,
  },
  snapshot: {
    cloudiness: 0.9,
    condition: 'overcast',
    precipitation: 0,
    sunAzimuthRadians: 1.32,
    sunElevationRadians: 0.035,
    windDirectionRadians: 0.42,
    windSpeedMph: 7,
  },
} as const;

export const RAIN_WEATHER_PROFILE: WeatherProfile = {
  id: 'rain',
  lighting: {
    hemisphereGroundColor: 0x30383b,
    hemisphereIntensity: 1.55,
    hemisphereSkyColor: 0x8f989d,
    keyLightColor: 0xbac0c4,
    keyLightIntensity: 0.95,
  },
  sky: {
    horizonColor: 0x70797f,
    overheadColor: 0x394248,
    radius: 420,
    rainColor: 0xb7c6cf,
    rainOpacity: 0.46,
    rainStreakCount: 420,
    sunColor: 0xc7c9c5,
    sunDiscRadius: 0,
    sunDistance: 330,
    sunGlowColor: 0x8f9694,
    sunGlowRadius: 0,
    sunVisible: false,
  },
  snapshot: {
    cloudiness: 1,
    condition: 'rain',
    precipitation: 0.72,
    sunAzimuthRadians: 1.32,
    sunElevationRadians: 0.035,
    windDirectionRadians: 0.5,
    windSpeedMph: 11,
  },
} as const;

export function createClearWeatherSnapshot(): WeatherSnapshot {
  return cloneWeatherSnapshot(CLEAR_WEATHER_PROFILE.snapshot);
}

export function createOvercastWeatherSnapshot(): WeatherSnapshot {
  return cloneWeatherSnapshot(OVERCAST_WEATHER_PROFILE.snapshot);
}

export function createRainWeatherSnapshot(): WeatherSnapshot {
  return cloneWeatherSnapshot(RAIN_WEATHER_PROFILE.snapshot);
}

export function resolveWeatherProfile(value: string | null | undefined): WeatherProfile {
  if (value === 'overcast') {
    return OVERCAST_WEATHER_PROFILE;
  }

  if (value === 'rain') {
    return RAIN_WEATHER_PROFILE;
  }

  return CLEAR_WEATHER_PROFILE;
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
