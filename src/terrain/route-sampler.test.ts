import { describe, it, expect } from 'vitest';
import { sampleRoute } from './route-sampler';

describe('sampleRoute', () => {
  it('emits endpoints exactly', () => {
    const from = { lat: 37.0, lon: -122.0 };
    const to = { lat: 37.5, lon: -121.0 };
    const samples = sampleRoute(from, to, 0.5);
    expect(samples[0].lat).toBe(from.lat);
    expect(samples[0].lon).toBe(from.lon);
    expect(samples[samples.length - 1].lat).toBe(to.lat);
    expect(samples[samples.length - 1].lon).toBe(to.lon);
  });

  it('monotonic along-track', () => {
    const samples = sampleRoute(
      { lat: 37, lon: -120 },
      { lat: 38, lon: -119 },
      1,
    );
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].alongTrackNm).toBeGreaterThan(samples[i - 1].alongTrackNm);
    }
  });

  it('offsets by startAlongTrackNm', () => {
    const samples = sampleRoute(
      { lat: 37, lon: -120 },
      { lat: 37.1, lon: -120 },
      5,
      100,
    );
    expect(samples[0].alongTrackNm).toBe(100);
  });

  it('degenerate zero-distance emits single point', () => {
    const samples = sampleRoute(
      { lat: 37, lon: -120 },
      { lat: 37, lon: -120 },
      0.5,
    );
    expect(samples).toHaveLength(1);
  });
});
