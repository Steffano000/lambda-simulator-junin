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

/**
 * Series de las gráficas climáticas (2 slots categóricos). Validados con
 * dataviz/validate_palette.js en modo claro y oscuro: CVD ΔE 21.9, contraste ≥ 3:1.
 * Agua (lluvia, tmin) = azul · Demanda/calor (ET0, tmed) = bermellón.
 */
export const serie = {
  agua: '#0072B2',
  demanda: '#D55E00',
} as const;

/**
 * Estados de hidratación (ordinales: seco → encharcado). Rampa divergente BrBG, apta para
 * daltonismo: marrón = falta de agua, neutro = adecuada, verde azulado = exceso. La
 * luminosidad baja hacia ambos extremos; "encharcado" además se dibuja con lámina de agua
 * en 3D (codificación secundaria) y siempre va con etiqueta en la leyenda.
 */
export const hidratacion = {
  seco: '#8C510A',
  baja: '#D8B365',
  adecuada: '#E9E7DC',
  alta: '#5AB4AC',
  saturado: '#01665E',
  encharcado: '#003C30',
} as const;

/**
 * Fidelidad del dato en la celda (parcela real de Junín, Fase 2). Mismos colores que la capa
 * «Fidelidad» del geovisor (src/ui/junin/colores.ts); siempre van con etiqueta en la leyenda.
 */
export const fidelidad = {
  real: '#1A9641',
  remuestreado: '#F0B429',
  extrapolado: '#7B3294',
} as const;

/**
 * Paleta natural de cada cultivo (modelos 3D e iconos). La etapa fenológica NO se lee de
 * estos colores sino de la forma (tamaño, flores, frutos) y del anillo de etapa en la base,
 * que sí usa `etapa` (design.md §3). Clave = `nombre` de data/cultivos.json.
 */
export const planta = {
  Papa: { tallo: '#4F7F34', hoja: '#4E8A3A', flor: '#B79AD6', fruto: '#A0703F', seca: '#9C9A4A' },
  'Maíz amiláceo': { tallo: '#6E9A3C', hoja: '#5E9E3A', flor: '#D8C27A', fruto: '#E9DCA8', seca: '#C2A95A' },
  Quinua: { tallo: '#6A8F3A', hoja: '#7FA64A', flor: '#C24E3C', fruto: '#E0A83A', seca: '#B8964A' },
  'Haba (grano seco)': {
    tallo: '#4F7F3A',
    hoja: '#5E8C4A',
    flor: '#F2F0EA',
    fruto: '#6FA052',
    seca: '#6B5A3A',
  },
  'Avena forrajera': {
    tallo: '#7DA24E',
    hoja: '#8DB25A',
    flor: '#C9B56A',
    fruto: '#D8C27A',
    seca: '#C7B26A',
  },
} as const satisfies Record<
  string,
  { tallo: string; hoja: string; flor: string; fruto: string; seca: string }
>;

export type PaletaPlanta = (typeof planta)[keyof typeof planta];

/** Elementos del clima en la escena: nubes (claras / de lluvia) y gotas. */
export const clima = {
  nube: '#EEF1F5',
  nubeLluvia: '#8D96A3',
  gota: '#9ECAE1',
} as const;

/** Fondo de la escena 3D por tema (debe casar con --ui-scene en styles/index.css). */
export const scene = {
  light: '#EEF1F4',
  dark: '#14181D',
} as const;

/**
 * Cielo de la escena según el estado del tiempo del día (src/domain/climate/CieloVisual
 * · src/scene/sky). Las claves son los `EstadoCieloVisual`.
 *
 * - `claro` / `oscuro`: fondo del lienzo 3D, uno por tema (no es un dato, es ambiente).
 * - `luz`: cuánto apaga la luz la escena (un día de lluvia vería la parcela más apagada).
 *
 * Tonos desaturados y de luminancia parecida entre estados: el fondo acompaña al dato sin
 * competir con el color de los overlays.
 */
export const cielo = {
  despejado: { claro: '#D8E7F4', oscuro: '#18242F', luz: 1 },
  calor: { claro: '#EFE1C6', oscuro: '#31281B', luz: 1.08 },
  nublado: { claro: '#CBD1D7', oscuro: '#212630', luz: 0.8 },
  niebla: { claro: '#D6D9D6', oscuro: '#262A29', luz: 0.72 },
  lluvia: { claro: '#A9B6C5', oscuro: '#1C222A', luz: 0.62 },
  'lluvia-fuerte': { claro: '#8C9AAC', oscuro: '#151A20', luz: 0.5 },
  helada: { claro: '#E0EBF4', oscuro: '#1E2B37', luz: 0.86 },
} as const;

/**
 * Luces de la escena 3D (src/scene/lighting): cielo de la hemisférica, rebote del suelo
 * y direccional. Sin sombras: la legibilidad del estado gana al realismo (§2).
 */
export const luz = {
  cielo: '#FFFFFF',
  /** Rebote cálido del terreno en la cara inferior de los bloques. */
  suelo: '#8A7A66',
  direccional: '#FFFFFF',
} as const;

/**
 * Marcas sobre la cara superior de la celda: selección del usuario y celdas que no
 * cumplen los requisitos del cultivo. Nunca compiten con la rampa del overlay.
 */
export const marcador = {
  seleccion: '#FFFFFF',
  resaltada: chi[25],
} as const;

export type SoilKey = keyof typeof soil;
export type SurfaceKey = keyof typeof surface;
export type EtapaKey = keyof typeof etapa;
export type ChiEstado = keyof typeof chiEstado;

export const tokens = {
  soil,
  surface,
  humedad,
  chi,
  chiEstado,
  divergente,
  etapa,
  serie,
  hidratacion,
  fidelidad,
  clima,
  planta,
  scene,
  cielo,
  luz,
  marcador,
} as const;
