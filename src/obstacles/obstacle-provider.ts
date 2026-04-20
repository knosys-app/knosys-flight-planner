import type { Obstacle, ProfileSample } from '../types';

/**
 * Obstacle data source. v0.2 implements this via the FAA Digital Obstacle
 * File preprocessed into a SQLite database and downloaded to OPFS on
 * user opt-in. Future providers could serve OpenAIP or OSM data.
 */
export interface ObstacleProvider {
  /** Resolves once the database is open and ready to query. */
  ready(): Promise<void>;

  /** Bounding-box query returning obstacles fully within the box. */
  obstaclesInBbox(
    bbox: [number, number, number, number],
  ): Promise<Obstacle[]>;

  /**
   * Finds obstacles within `corridorNm` of any sampled route point. The
   * returned list is deduped by obstacle id. Implementations should batch
   * the bbox of the corridor for performance.
   */
  obstaclesAlongRoute(
    samples: Array<Pick<ProfileSample, 'lat' | 'lon'>>,
    corridorNm: number,
  ): Promise<Obstacle[]>;
}
