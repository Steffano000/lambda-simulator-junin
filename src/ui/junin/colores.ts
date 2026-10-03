/** Colores y leyendas de las capas de chunks y de las capas NASA del geovisor. */
import type { Chunk } from '@/domain/junin/parcela';
import type { CapaChunk, BaseNasa, OverlayNasa } from '@/store/juninStore';
import { phColor, soilColor } from '@/theme/ramps';

type Stop = [number, string];

function rampa(stops: Stop[], v: number): string {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i];
    const [x0, c0] = stops[i - 1];
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0 || 1);
      const a = parseInt(c0.slice(1), 16);
      const b = parseInt(c1.slice(1), 16);
      const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
      return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
    }
  }
  return stops[stops.length - 1][1];
}

/** Colores oficiales de ESA WorldCover */
export const COLOR_WORLDCOVER: Record<string, string> = {
  '10': '#006400',
  '20': '#FFBB22',
  '30': '#FFFF4C',
  '40': '#F096FF',
  '50': '#FA0000',
  '60': '#B4B4B4',
  '70': '#F0F0F0',
  '80': '#0064C8',
  '90': '#0096A0',
  '95': '#00CF75',
  '100': '#FAE6A0',
};

export const COLOR_REGLA = { permitido: '#2E8B57', advertencia: '#E3A72F', bloqueado: '#C0392B' } as const;

/** Estado del chunk (Fase 1) */
export const COLOR_ESTADO = {
  con_dato: '#2E8B57',
  interpolado: '#E3C02F',
  sin_dato: '#9AA0A6',
  bloqueado: '#C0392B',
} as const;
const COLOR_SIN_DATO = '#9AA0A6';

const RAMPA_ELEV: Stop[] = [
  [0, '#1A9850'],
  [0.5, '#FEE08B'],
  [1, '#8C510A'],
];
const RAMPA_PEND: Stop[] = [
  [0, '#FFFFCC'],
  [10, '#FD8D3C'],
  [25, '#BD0026'],
];
const RAMPA_NDVI: Stop[] = [
  [0, '#A6611A'],
  [0.3, '#DFC27D'],
  [0.5, '#A6D96A'],
  [0.8, '#1A9641'],
];
const RAMPA_REND: Stop[] = [
  [0, '#D7191C'],
  [0.5, '#FDAE61'],
  [0.8, '#A6D96A'],
  [1, '#1A9641'],
];

export interface ContextoColor {
  elevMin: number;
  elevMax: number;
  rendMax: number;
  rend?: (number | null)[];
}

export function colorChunk(c: Chunk, i: number, capa: CapaChunk, ctx: ContextoColor): string | null {
  if (c.estado === 'sin_dato' && capa !== 'estado') return COLOR_SIN_DATO;
  switch (capa) {
    case 'estado':
      return COLOR_ESTADO[c.estado];
    case 'regla':
      if (c.estado === 'bloqueado') return COLOR_REGLA.bloqueado;
      return c.regla ? COLOR_REGLA[c.regla] : null;
    case 'cobertura':
      return c.worldcover == null ? null : (COLOR_WORLDCOVER[String(c.worldcover)] ?? null);
    case 'elevacion':
      return c.elevacion_m == null
        ? null
        : rampa(RAMPA_ELEV, (c.elevacion_m - ctx.elevMin) / (ctx.elevMax - ctx.elevMin || 1));
    case 'pendiente':
      return c.pendiente_grados == null ? null : rampa(RAMPA_PEND, c.pendiente_grados);
    case 'textura':
      return c.textura ? soilColor(c.textura) : null;
    case 'ph':
      return c.ph == null ? null : phColor(c.ph);
    case 'ndvi':
      return c.ndvi == null ? null : rampa(RAMPA_NDVI, c.ndvi);
    case 'rendimiento': {
      const v = ctx.rend?.[i];
      return v == null ? null : rampa(RAMPA_REND, v / (ctx.rendMax || 1));
    }
  }
}

export const ETIQUETA_CAPA: Record<CapaChunk, string> = {
  estado: 'Datos',
  regla: 'Uso permitido',
  cobertura: 'Cobertura',
  elevacion: 'Altura',
  pendiente: 'Pendiente',
  textura: 'Textura',
  ph: 'pH',
  ndvi: 'NDVI',
  rendimiento: 'Rendimiento',
};

/** Leyenda de cada capa: [color, texto] */
export function leyendaCapa(capa: CapaChunk, ctx: ContextoColor, presentes: Chunk[]): [string, string][] {
  switch (capa) {
    case 'estado':
      return [
        [COLOR_ESTADO.con_dato, 'Dato a 30 m'],
        [COLOR_ESTADO.interpolado, 'Dato a ~1 km'],
        [COLOR_ESTADO.sin_dato, 'Sin dato'],
        [COLOR_ESTADO.bloqueado, 'Bloqueado'],
      ];
    case 'regla':
      return [
        [COLOR_REGLA.permitido, 'Permitido'],
        [COLOR_REGLA.advertencia, 'Advertencia'],
        [COLOR_REGLA.bloqueado, 'Bloqueado'],
      ];
    case 'cobertura': {
      const nombres: Record<string, string> = {
        '10': 'Bosque',
        '20': 'Matorral',
        '30': 'Pastizal',
        '40': 'Cultivos',
        '50': 'Urbano',
        '60': 'Suelo desnudo',
        '70': 'Nieve',
        '80': 'Agua',
        '90': 'Bofedal',
        '100': 'Musgo',
      };
      const usados = [...new Set(presentes.map((c) => String(c.worldcover)))];
      return usados.filter((k) => nombres[k]).map((k) => [COLOR_WORLDCOVER[k], nombres[k]]);
    }
    case 'elevacion':
      return [
        [rampa(RAMPA_ELEV, 0), `${Math.round(ctx.elevMin)} m`],
        [rampa(RAMPA_ELEV, 1), `${Math.round(ctx.elevMax)} m`],
      ];
    case 'pendiente':
      return [
        [rampa(RAMPA_PEND, 0), '0°'],
        [rampa(RAMPA_PEND, 10), '10°'],
        [rampa(RAMPA_PEND, 25), '≥ 25°'],
      ];
    case 'textura': {
      const usados = [...new Set(presentes.map((c) => c.textura).filter((x): x is string => !!x))];
      return usados.map((t) => [soilColor(t), t]);
    }
    case 'ph':
      return [
        [phColor(5), '5'],
        [phColor(7), '7'],
        [phColor(8.5), '8.5'],
      ];
    case 'ndvi':
      return [
        [rampa(RAMPA_NDVI, 0.1), '0.1'],
        [rampa(RAMPA_NDVI, 0.5), '0.5'],
        [rampa(RAMPA_NDVI, 0.8), '0.8'],
      ];
    case 'rendimiento':
      return [
        [rampa(RAMPA_REND, 0), '0 t/ha'],
        [rampa(RAMPA_REND, 1), `${ctx.rendMax.toFixed(1)} t/ha`],
      ];
  }
}

// ---------------------------------------------------------------------------
// Capas NASA GIBS (WMTS, EPSG:3857). Si GIBS cambia un nombre, se corrige aquí.
// ---------------------------------------------------------------------------
export interface CapaGibs {
  id: string;
  nombre: string;
  nivel: number;
  ext: 'jpeg' | 'png';
  /** Fecha fija o desfase en días (capas con latencia) */
  desfaseDias?: number;
  sinFecha?: boolean;
  /** Compuesto MODIS de 16 días: la fecha se ajusta al inicio del periodo (día 1, 17, 33… del año) */
  periodo16?: boolean;
}

// ---------------------------------------------------------------------------
// Imágenes de alta resolución para DIBUJAR la parcela (no entran en los cálculos)
// ---------------------------------------------------------------------------
export interface CapaFija {
  nombre: string;
  corto: string;
  url: string;
  /** Último zoom con imagen propia (más allá se amplía) */
  maxNativo: number;
  atribucion: string;
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const BASES_HD: Record<'esri' | 'eox', CapaFija> = {
  esri: {
    nombre: 'Satélite HD (Esri World Imagery, ~1 m)',
    corto: 'Satélite HD',
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    // En Junín Esri tiene imagen hasta el zoom 17; en 18-19 devuelve "no disponible"
    maxNativo: 17,
    atribucion: 'Imagen © Esri, Maxar, Earthstar Geographics y la comunidad de usuarios GIS',
  },
  eox: {
    nombre: 'Sentinel-2 sin nubes 2023 (EOX, 10 m)',
    corto: 'Sentinel-2',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg',
    maxNativo: 15,
    atribucion: 'Sentinel-2 cloudless 2023 © EOX IT Services GmbH (datos Copernicus Sentinel modificados)',
  },
};

/** Nombres y vías nítidos para las imágenes HD */
export const ETIQUETAS_HD = [
  `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
  `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
];

export const esBaseHD = (b: BaseNasa): b is 'esri' | 'eox' => b === 'esri' || b === 'eox';

export const NOMBRE_BASE: Record<BaseNasa, string> = {
  esri: 'Satélite HD',
  eox: 'Sentinel-2',
  modis: 'MODIS',
  viirs: 'VIIRS',
  hls: 'HLS 30 m',
};

export const BASES_NASA: Record<'modis' | 'viirs' | 'hls', CapaGibs> = {
  modis: {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    nombre: 'MODIS Terra · color verdadero (250 m)',
    nivel: 9,
    ext: 'jpeg',
  },
  viirs: {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    nombre: 'VIIRS SNPP · color verdadero (375 m)',
    nivel: 9,
    ext: 'jpeg',
  },
  hls: {
    id: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance',
    nombre: 'HLS Sentinel-2 · 30 m sobre MODIS (acerca el mapa; imagen cada 2-5 días)',
    nivel: 12,
    ext: 'png',
  },
};

export const OVERLAYS_NASA: Record<OverlayNasa, CapaGibs> = {
  ndvi: {
    id: 'MODIS_Terra_L3_NDVI_16Day',
    nombre: 'NDVI MODIS 16 días',
    nivel: 9,
    ext: 'png',
    periodo16: true,
  },
  humedad: {
    id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
    nombre: 'Humedad del suelo SMAP L4',
    nivel: 6,
    ext: 'png',
    desfaseDias: 4,
  },
  lluvia: {
    id: 'IMERG_Precipitation_Rate',
    nombre: 'Lluvia IMERG (GPM)',
    nivel: 6,
    ext: 'png',
    desfaseDias: 1,
  },
  etiquetas: {
    // Reference_Labels_15m devuelve teselas negras opacas (comprobado el 3-oct-2026): se usa la de 9 niveles
    id: 'Reference_Labels',
    nombre: 'Nombres y vías',
    nivel: 9,
    ext: 'png',
    sinFecha: true,
  },
};

/** Fecha válida para la capa (latencia y periodos de los compuestos) */
export function fechaCapa(c: CapaGibs, fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  if (c.desfaseDias) d.setUTCDate(d.getUTCDate() - c.desfaseDias);
  if (c.periodo16) {
    // el compuesto sale ~1 mes después: se retrocede 32 días y se ajusta al inicio del periodo
    d.setUTCDate(d.getUTCDate() - 32);
    const inicioAnio = Date.UTC(d.getUTCFullYear(), 0, 1);
    const doy = Math.floor((d.getTime() - inicioAnio) / 86_400_000);
    d.setTime(inicioAnio + Math.floor(doy / 16) * 16 * 86_400_000 + 12 * 3600_000);
  }
  return d.toISOString().slice(0, 10);
}

export function urlGibs(c: CapaGibs, fecha: string): string {
  // Las capas estáticas (sin dimensión de tiempo) no llevan fecha en la URL REST
  const tiempo = c.sinFecha ? '' : `${fechaCapa(c, fecha)}/`;
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${c.id}/default/${tiempo}GoogleMapsCompatible_Level${c.nivel}/{z}/{y}/{x}.${c.ext}`;
}
