import { describe, expect, it } from 'vitest';
import {
  CLEAR_WEATHER_PROFILE,
  createClearWeatherSnapshot,
} from '../../src/weather/WeatherProfile';
import {
  calculateSunWorldDirection,
  createClearWeatherModel,
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
    expect(first.sunElevationRadians).toBeGreaterThan(0.5);
    expect(first.sunElevationRadians).toBeLessThan(Math.PI / 2);
  });

  it('calculates a normalized elevated sun direction', () => {
    const direction = calculateSunWorldDirection(CLEAR_WEATHER_PROFILE.snapshot);
    const length = Math.hypot(direction.x, direction.y, direction.z);

    expect(length).toBeCloseTo(1, 6);
    expect(direction.y).toBeGreaterThan(0.65);
    expect(direction.x).toBeLessThan(0);
    expect(direction.z).toBeLessThan(0);
  });
});
