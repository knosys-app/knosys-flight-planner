// Unit conversions. Kept pure. All storage is US customary internally;
// these helpers are applied at the UI boundary when settings.units === 'metric'.

export const NM_PER_KM = 0.5399568034557235;
export const KM_PER_NM = 1.852;
export const FT_PER_M = 3.280839895013123;
export const M_PER_FT = 0.3048;
export const GAL_PER_L = 0.2641720523581484;
export const L_PER_GAL = 3.785411784;
export const LB_PER_KG = 2.2046226218487757;
export const KG_PER_LB = 0.45359237;

export const nmToKm = (nm: number): number => nm * KM_PER_NM;
export const kmToNm = (km: number): number => km * NM_PER_KM;
export const ftToM = (ft: number): number => ft * M_PER_FT;
export const mToFt = (m: number): number => m * FT_PER_M;
export const galToL = (gal: number): number => gal * L_PER_GAL;
export const lToGal = (l: number): number => l * GAL_PER_L;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const ktToKmh = (kt: number): number => kt * 1.852;
export const kmhToKt = (kmh: number): number => kmh / 1.852;
export const cToF = (c: number): number => (c * 9) / 5 + 32;
export const fToC = (f: number): number => ((f - 32) * 5) / 9;
