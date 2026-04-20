// Mapzen/AWS Terrarium RGB elevation encoding:
//   elevation_meters = (R * 256 + G + B / 256) - 32768
// 0x800080 = 0 m; higher R → taller, lower R → below sea level. Oceans
// encode as -32768 (all zero). Returns elevation in METERS.

const METERS_TO_FT = 3.28084;

export function decodeTerrariumPixelMeters(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function decodeTerrariumPixelFeet(r: number, g: number, b: number): number {
  return decodeTerrariumPixelMeters(r, g, b) * METERS_TO_FT;
}

/**
 * Decode a full Terrarium tile's RGBA bytes (from canvas.getImageData) into
 * a Float32Array of elevations in feet MSL. Array length = width * height.
 */
export function decodeTerrariumTileFeet(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = decodeTerrariumPixelFeet(rgba[p], rgba[p + 1], rgba[p + 2]);
  }
  return out;
}
