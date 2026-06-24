export type WeatherCondition = 'clear' | 'overcast';

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
  sunColor: number;
  sunDiscRadius: number;
  sunDistance: number;
  sunGlowColor: number;
  sunGlowRadius: number;
}

export interface WeatherProfile {
  id: WeatherCondition;
  lighting: WeatherLightingProfile;
  sky: WeatherSkyProfile;
  snapshot: WeatherSnapshot;
}

export interface WeatherPresentationSnapshot extends WeatherSnapshot {
  lightingIntensity: number;
  skyEnabled: boolean;
  skyObjectCount: number;
  sunDiscWorldPosition: WeatherVectorSnapshot;
  sunLightPosition: WeatherVectorSnapshot;
  sunWorldDirection: WeatherVectorSnapshot;
}
