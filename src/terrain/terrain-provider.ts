import type { LatLon, ProfileSample } from '../types';

/**
 * Elevation data source. v0.2 implements this with AWS Terrarium tiles
 * range-fetched through `api.network.fetch` and cached in OPFS. Future
 * offline builds can swap in a PMTiles-backed implementation (Mapterhorn).
 */
export interface TerrainProvider {
  /** Returns elevation in feet MSL at the given coordinates. */
  elevationAt(lat: number, lon: number): Promise<number>;

  /**
   * Samples the great-circle route between two points at the given step in
   * nautical miles. The `startAlongTrackNm` parameter lets callers chain
   * per-leg samples into a continuous route-level along-track axis.
   */
  sampleAlongRoute(
    from: LatLon,
    to: LatLon,
    stepNm: number,
    startAlongTrackNm?: number,
  ): Promise<ProfileSample[]>;
}
