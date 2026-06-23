import {
  CLEAR_WEATHER_PROFILE,
  cloneWeatherSnapshot,
} from './WeatherProfile';
import type {
  WeatherProfile,
  WeatherSnapshot,
  WeatherVectorSnapshot,
} from './WeatherTypes';

export class WeatherModel {
  constructor(private readonly profile: WeatherProfile = CLEAR_WEATHER_PROFILE) {}

  getProfile(): WeatherProfile {
    return this.profile;
  }

  getSnapshot(): WeatherSnapshot {
    return cloneWeatherSnapshot(this.profile.snapshot);
  }
}

export function createClearWeatherModel(): WeatherModel {
  return new WeatherModel(CLEAR_WEATHER_PROFILE);
}

export function calculateSunWorldDirection(
  snapshot: WeatherSnapshot,
): WeatherVectorSnapshot {
  const horizontal = Math.cos(snapshot.sunElevationRadians);
  const direction = {
    x: Math.sin(snapshot.sunAzimuthRadians) * horizontal,
    y: Math.sin(snapshot.sunElevationRadians),
    z: Math.cos(snapshot.sunAzimuthRadians) * horizontal,
  };
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
}
