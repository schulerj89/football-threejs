import { describe, expect, it } from 'vitest';
import {
  CLEAR_WEATHER_PROFILE,
  createClearWeatherSnapshot,
  createOvercastWeatherSnapshot,
  createRainWeatherSnapshot,
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

  it('resolves deterministic weather profiles from weather selection', () => {
    const overcastSnapshot = createWeatherModel('overcast').getSnapshot();
    const rainSnapshot = createWeatherModel('rain').getSnapshot();

    expect(overcastSnapshot).toEqual(createOvercastWeatherSnapshot());
    expect(overcastSnapshot).toMatchObject({
      cloudiness: 0.9,
      condition: 'overcast',
      precipitation: 0,
      windSpeedMph: 7,
    });
    expect(rainSnapshot).toEqual(createRainWeatherSnapshot());
    expect(rainSnapshot).toMatchObject({
      cloudiness: 1,
      condition: 'rain',
      precipitation: 0.72,
      windSpeedMph: 11,
    });
    expect(createWeatherModel('fog').getSnapshot()).toEqual(createClearWeatherSnapshot());
  });
});
