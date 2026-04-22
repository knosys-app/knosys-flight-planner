// Density altitude math.
//
// Standard-atmosphere reference:
//   • Sea-level pressure: 29.92 inHg
//   • Sea-level temp:     15 °C
//   • Temperature lapse:  −1.98 °C per 1000 ft (≈ 2 °C / kft)
//
// Pressure altitude (ft) = fieldElevFt + (29.92 − altimeterInHg) * 1000
// ISA temp at pressure alt = 15 − 2 * (PA / 1000)
// Density altitude (ft)  = PA + 120 * (OAT − ISA)        (NWS approximation)

export interface DensityAltitudeInput {
  /** Field elevation in feet MSL. */
  fieldElevFt: number;
  /** Outside-air temperature in °C. */
  tempC: number;
  /** Altimeter setting in inches of mercury. */
  altimeterInHg: number;
}

export interface DensityAltitudeResult {
  pressureAltFt: number;
  isaTempC: number;
  densityAltFt: number;
  /** DA − field elevation. Positive = density altitude above the field. */
  deviationFt: number;
}

export function computeDensityAltitude(
  input: DensityAltitudeInput,
): DensityAltitudeResult {
  const { fieldElevFt, tempC, altimeterInHg } = input;
  const pressureAltFt = fieldElevFt + (29.92 - altimeterInHg) * 1000;
  const isaTempC = 15 - 2 * (pressureAltFt / 1000);
  const densityAltFt = pressureAltFt + 120 * (tempC - isaTempC);
  return {
    pressureAltFt: Math.round(pressureAltFt),
    isaTempC: Math.round(isaTempC * 10) / 10,
    densityAltFt: Math.round(densityAltFt),
    deviationFt: Math.round(densityAltFt - fieldElevFt),
  };
}

/**
 * Returns a short label like "DA +1,200 ft" when density altitude deviates
 * from the field elevation by at least `thresholdFt`; otherwise null.
 */
export function densityAltitudeChip(
  result: DensityAltitudeResult,
  thresholdFt = 500,
): string | null {
  if (Math.abs(result.deviationFt) < thresholdFt) return null;
  const sign = result.deviationFt >= 0 ? '+' : '−';
  return `DA ${sign}${Math.abs(result.deviationFt).toLocaleString()} ft`;
}
