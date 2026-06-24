import { describe, expect, it } from 'vitest';
import {
  CLEAR_WEATHER_PROFILE,
  createClearWeatherSnapshot,
  createOvercastWeatherSnapshot,
} from '../../src/weather/WeatherProfile';
import {
  calculateSunWorldDirection,
  createClearWeatherModel,
  createWeatherModel,
} from '../../src/weather/WeatherModel';

describe('clear weather model', () => {
  it('resolves deterministic clear-weather values', () => {
    const first = createClearWeatherModel().getSnapshot();
    const second = createClearWeatherModel().getSnapshot();

    expect(first).toEqual(second);
    expect(first).toEqual(createClearWeatherSnapshot());
    expect(first).toMatchObject({
      cloudiness: 0,
      condition: 'clear',
      precipitation: 0,
      windSpeedMph: 4,
    });
    expect(first.sunElevationRadians).toBeGreaterThan(0.03);
    expect(first.sunElevationRadians).toBeLessThan(0.1);
  });

  it('calculates a normalized elevated sun direction', () => {
    const direction = calculateSunWorldDirection(CLEAR_WEATHER_PROFILE.snapshot);
    const length = Math.hypot(direction.x, direction.y, direction.z);

    expect(length).toBeCloseTo(1, 6);
    expect(direction.y).toBeGreaterThan(0.03);
    expect(direction.y).toBeLessThan(0.1);
    expect(direction.x).toBeGreaterThan(0);
    expect(direction.z).toBeGreaterThan(0);
  });

  it('resolves a deterministic overcast profile from weather selection', () => {
    const snapshot = createWeatherModel('overcast').getSnapshot();

    expect(snapshot).toEqual(createOvercastWeatherSnapshot());
    expect(snapshot).toMatchObject({
      cloudiness: 0.9,
      condition: 'overcast',
      precipitation: 0,
      windSpeedMph: 7,
    });
    expect(createWeatherModel('rain').getSnapshot()).toEqual(createClearWeatherSnapshot());
  });
});
