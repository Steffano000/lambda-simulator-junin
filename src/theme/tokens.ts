/**
 * Design tokens — fuente ÚNICA de color del simulador (docs/design.md §3).
 *
 * Los consumen dos mundos:
 *  - Tailwind (tailwind.config.ts) → clases de UI: leyendas, inspector, gráficas.
 *  - Three.js (src/theme/ramps.ts) → color de instancias y overlays de la grilla.
 *
 * Reglas:
 *  - Paleta color-vision-safe (deuteranopia/protanopia): las rampas varían en
 *    luminosidad y no solo en tono; el color nunca es el único canal (leyenda + valor).
 *  - Suelos: rampa terrosa opaca, clara (arena) → media (franco) → oscura (arcilla).
 *    Rojo y gris quedan RESERVADOS para agua/roca/nieve (EP-02.2), nunca para suelos.
 */

/** Clases de suelo, claves = slug de `clase` en data/terrenos.json. */
export const soil = {
  arena: '#E9D29B',
  'arena-franca': '#DEC084',
  'franco-arenoso': '#CCA266',
  franco: '#AC7C47',
  'franco-limoso': '#9C6F42',
  limo: '#8E6647',
  'franco-arcillo-limoso': '#704C31',
  'arcilla-limosa': '#5F3D27',
  arcilla: '#4B2D1C',
  /** Comparte la rampa arcilla (design.md §3). Suelo de referencia de la parcela. */
  'franco-arcilloso': '#5A3522',
} as const;

/** Superficies no edáficas (EP-02.2). */
export const surface = {
  agua: '#2F6690',
  roca: '#8A8F96',
  nieve: '#F1F4F7',
  vacio: '#C9CDD2',
} as const;

/** Humedad 0–100 %: azul progresivo, de blanquecino (seco) a azul profundo (CC/saturado). */
export const humedad = {
  0: '#F7FBFF',
  20: '#C6DBEF',
  40: '#9ECAE1',
  60: '#4292C6',
  80: '#2171B5',
  100: '#08306B',
} as const;

/**
 * CHI (Crop Health Index) 0–100: rojo → ámbar → verde.
 * El verde tira a azul (teal) y la luminosidad cambia en cada tramo para que el
 * extremo sano y el crítico no se confundan con deuteranopia.
 * `0` = déficit severo (ancla de anulación de yield, paso 06).
 */
export const chi = {
  0: '#5C0011',
  25: '#C8321E',
  50: '#F2A531',
  75: '#7DBE9B',
  100: '#1B7F79',
} as const;

/** Estados discretos del CHI (paso 06 · patrón State). */
export const chiEstado = {
  saludable: chi[100],
  estresado: chi[50],
  critico: chi[25],
  muerto: chi[0],
} as const;

/**
 * Rampa divergente (PuOr) para pH y N-P-K: bajo = frío (violeta), alto = cálido (naranja).
 * Claves: n3…p3 = desviación normalizada respecto al óptimo; `0` = neutro/óptimo.
 */
export const divergente = {
  n3: '#542788',
  n2: '#8073AC',
  n1: '#B2ABD2',
  0: '#F4F1EC',
  p1: '#FDB863',
  p2: '#E08214',
  p3: '#B35806',
} as const;

/** Etapa fenológica: 1 color por etapa (Okabe-Ito, seguro para daltonismo). */
export const etapa = {
  siembra: '#CC79A7',
  germinacion: '#56B4E9',
  desarrollo: '#009E73',
  media: '#0072B2',
  final: '#E69F00',
  cosecha: '#D55E00',
} as const;

/** Fondo de la escena 3D por tema (debe casar con --ui-scene en styles/index.css). */
export const scene = {
  light: '#EEF1F4',
  dark: '#14181D',
} as const;

export type SoilKey = keyof typeof soil;
export type SurfaceKey = keyof typeof surface;
export type EtapaKey = keyof typeof etapa;
export type ChiEstado = keyof typeof chiEstado;

export const tokens = { soil, surface, humedad, chi, chiEstado, divergente, etapa, scene } as const;
