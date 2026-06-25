export type WeatherCondition = 'clear' | 'overcast' | 'rain';

export interface WeatherSnapshot {
  condition: WeatherCondition;
  cloudiness: number;
  precipitation: number;
  sunAzimuthRadians: number;
  sunElevationRadians: number;
  windDirectionRadians: number;
  windSpeedMph: number;
}

export interface WeatherVectorSnapshot {
  x: number;
  y: number;
  z: number;
}

export interface WeatherLightingProfile {
  hemisphereGroundColor: number;
  hemisphereIntensity: number;
  hemisphereSkyColor: number;
  keyLightColor: number;
  keyLightIntensity: number;
}

export interface WeatherSkyProfile {
  horizonColor: number;
  overheadColor: number;
  radius: number;
  rainColor?: number;
  rainOpacity?: number;
  rainStreakCount?: number;
  sunColor: number;
  sunDiscRadius: number;
  sunDistance: number;
  sunGlowColor: number;
  sunGlowRadius: number;
  sunVisible: boolean;
}

export interface WeatherProfile {
  id: WeatherCondition;
  lighting: WeatherLightingProfile;
  sky: WeatherSkyProfile;
  snapshot: WeatherSnapshot;
}

export interface WeatherPresentationSnapshot extends WeatherSnapshot {
  lightingIntensity: number;
  precipitationObjectCount: number;
  rainFallOffset: number;
  rainStreakCount: number;
  skyEnabled: boolean;
  skyObjectCount: number;
  sunDiscWorldPosition: WeatherVectorSnapshot;
  sunLightPosition: WeatherVectorSnapshot;
  sunVisible: boolean;
  sunWorldDirection: WeatherVectorSnapshot;
}
