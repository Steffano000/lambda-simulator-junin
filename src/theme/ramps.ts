/**
 * Mapeo declarativo estado → color (patrón State→Visual, design.md §4).
 * Funciones puras: sin Three.js ni React, reutilizables en escena, leyenda y tests.
 */
import { chi, divergente, etapa, humedad, soil, surface, type EtapaKey, type SoilKey } from './tokens';

type Stops = Record<string | number, string>;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  '#' +
  [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

/** Interpola linealmente una rampa de claves numéricas (p. ej. 0/20/…/100). */
export function sampleRamp(stops: Stops, value: number): string {
  const keys = Object.keys(stops)
    .map(Number)
    .sort((a, b) => a - b);
  const v = Math.min(Math.max(value, keys[0]), keys[keys.length - 1]);
  for (let i = 0; i < keys.length - 1; i++) {
    const [k0, k1] = [keys[i], keys[i + 1]];
    if (v <= k1) {
      const t = (v - k0) / (k1 - k0);
      const a = hexToRgb(stops[k0]);
      const b = hexToRgb(stops[k1]);
      return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    }
  }
  return stops[keys[keys.length - 1]];
}

/** "Franco arcillo limoso" → "franco-arcillo-limoso". */
export const soilSlug = (clase: string): string =>
  clase.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '-');

export function soilColor(clase: string): string {
  return soil[soilSlug(clase) as SoilKey] ?? surface.vacio;
}

export const humidityColor = (pct: number): string => sampleRamp(humedad, pct);

export const chiColor = (value: number): string => sampleRamp(chi, value);

const divergenteNumeric: Stops = {
  [-3]: divergente.n3,
  [-2]: divergente.n2,
  [-1]: divergente.n1,
  0: divergente[0],
  1: divergente.p1,
  2: divergente.p2,
  3: divergente.p3,
};

/** Desviación normalizada (−3…+3) → rampa divergente (pH, N-P-K). */
export const divergentColor = (deviation: number): string => sampleRamp(divergenteNumeric, deviation);

/** pH: 7 = neutro; cada unidad de pH = un paso de la rampa. */
export const phColor = (ph: number): string => divergentColor(ph - 7);

export const stageColor = (stage: EtapaKey): string => etapa[stage];
