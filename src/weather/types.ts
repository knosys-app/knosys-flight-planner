export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';

export type CloudCoverage = 'SKC' | 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';

export interface CloudLayer {
  coverage: CloudCoverage;
  baseFtAgl: number | null;
}

export interface MetarObservation {
  icao: string;
  /** When the observation was made, ISO-8601 UTC. */
  observedAtIso: string;
  /** When this client received the response, ISO-8601 UTC. Used for staleness. */
  fetchedAtIso: string;
  rawText: string;
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  /** Statute miles. `Infinity` indicates visibility reported as 10+. */
  visibilitySm: number | null;
  altimeterInHg: number | null;
  clouds: CloudLayer[];
  /**
   * Lowest broken/overcast/VV layer in feet AGL. Null when sky is clear or
   * when only FEW/SCT are reported.
   */
  ceilingFtAgl: number | null;
  flightCategory: FlightCategory;
  wxString: string | null;
}
