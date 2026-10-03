/**
 * Parcela dibujada por el usuario → grilla de chunks (pasos 3 a 6 y 11 de la secuencia).
 *
 * Fase 1 (sin servidor): cada chunk toma sus datos de
 *   - la parcela de 30 m del punto más cercano, si el chunk cae dentro de esa ventana, o
 *   - la grilla de Junín a ~1 km (elevación interpolada, el resto de la celda que lo contiene).
 * Fase 2: el servidor (server/main.py) devuelve la misma estructura leyendo los TIF a 30 m.
 *
 * Tamaño de chunk: 30 m (resolución del uso de suelo). Si la parcela es grande, el chunk
 * crece en múltiplos de 30 m para no pasar de MAX_LADO chunks por lado.
 */
import turfArea from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon as turfPolygon } from '@turf/helpers';
import type { EcoCrop, GrillaCapas, Parcela, ReglaUso, ReglasUsoSuelo } from '@/data/junin/types';
import { indiceEnGrilla, valorCapa } from './grilla';

/** Anillo exterior [lon, lat] (no hace falta repetir el primer vértice) */
export type Anillo = [number, number][];

export const CELDA_BASE_M = 30;
export const MAX_LADO = 60;
const M_POR_GRADO = 111_320;

export type FuenteChunk = '30m' | '1km' | 'servidor';

export interface Chunk {
  fila: number;
  columna: number;
  lat: number;
  lon: number;
  /** El centro del chunk está dentro de la parcela dibujada */
  dentro: boolean;
  elevacion_m: number | null;
  pendiente_grados: number | null;
  worldcover: number | null;
  regla: ReglaUso | null;
  arena_pct: number | null;
  arcilla_pct: number | null;
  limo_pct: number | null;
  cos_pct: number | null;
  ph: number | null;
  ndvi: number | null;
  /** Clase de data/terrenos.json */
  textura: string | null;
  fuente: FuenteChunk;
}

export interface GrillaChunks {
  celda_m: number;
  filas: number;
  columnas: number;
  /** [oeste, sur, este, norte] */
  bbox: [number, number, number, number];
  dlat: number;
  dlon: number;
  chunks: Chunk[];
  origen: 'local' | 'servidor';
}

const cerrar = (a: Anillo): Anillo =>
  a.length && (a[0][0] !== a[a.length - 1][0] || a[0][1] !== a[a.length - 1][1]) ? [...a, a[0]] : a;

export const poligonoTurf = (a: Anillo) => turfPolygon([cerrar(a)]);

/** Área de la parcela en hectáreas (Turf, geodésica) */
export const areaHa = (a: Anillo): number => (a.length < 3 ? 0 : turfArea(poligonoTurf(a)) / 10_000);

export function centroide(a: Anillo): { lat: number; lon: number } {
  const n = a.length || 1;
  return { lon: a.reduce((s, p) => s + p[0], 0) / n, lat: a.reduce((s, p) => s + p[1], 0) / n };
}

/** Cuadrado de `lado_m` metros centrado en (lat, lon): parcela de ejemplo */
export function cuadrado(lat: number, lon: number, lado_m: number): Anillo {
  const dlat = lado_m / 2 / M_POR_GRADO;
  const dlon = lado_m / 2 / (M_POR_GRADO * Math.cos((lat * Math.PI) / 180));
  return [
    [lon - dlon, lat + dlat],
    [lon + dlon, lat + dlat],
    [lon + dlon, lat - dlat],
    [lon - dlon, lat - dlat],
  ];
}

/** Tamaño de chunk para que la grilla no pase de MAX_LADO por lado */
export function tamanoChunk(a: Anillo): number {
  const lats = a.map((p) => p[1]);
  const lons = a.map((p) => p[0]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const alto = (Math.max(...lats) - Math.min(...lats)) * M_POR_GRADO;
  const ancho = (Math.max(...lons) - Math.min(...lons)) * M_POR_GRADO * Math.cos((lat0 * Math.PI) / 180);
  const lado = Math.max(alto, ancho);
  return CELDA_BASE_M * Math.max(1, Math.ceil(lado / (CELDA_BASE_M * MAX_LADO)));
}

/** Elevación bilineal en la grilla de 1 km (suaviza el relieve entre celdas) */
function elevacionBilineal(g: GrillaCapas, lat: number, lon: number): number | null {
  const capa = g.capas.elevacion_m;
  if (!capa) return null;
  const [oeste, , , norte] = g.bbox;
  const r = g.resolucion_grados;
  const fx = (lon - oeste) / r - 0.5;
  const fy = (norte - lat) / r - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const v = (x: number, y: number) => {
    const xc = Math.min(g.ancho - 1, Math.max(0, x));
    const yc = Math.min(g.alto - 1, Math.max(0, y));
    return valorCapa(capa, yc * g.ancho + xc);
  };
  const a = v(x0, y0);
  const b = v(x0 + 1, y0);
  const c = v(x0, y0 + 1);
  const d = v(x0 + 1, y0 + 1);
  if (a == null || b == null || c == null || d == null)
    return valorCapa(capa, indiceEnGrilla(g, lat, lon) ?? -1);
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

/** Celda de una parcela de 30 m que contiene (lat, lon), o null */
function indiceEnParcela(p: Parcela, lat: number, lon: number): number | null {
  const [oeste, sur, este, norte] = p.bbox;
  if (lon < oeste || lon >= este || lat <= sur || lat > norte) return null;
  const col = Math.floor(((lon - oeste) / (este - oeste)) * p.columnas);
  const fila = Math.floor(((norte - lat) / (norte - sur)) * p.filas);
  return fila * p.columnas + col;
}

export interface FuentesLocales {
  grilla: GrillaCapas;
  parcelas: readonly Parcela[];
  reglas: ReglasUsoSuelo;
}

const reglaDe = (wc: number | null, reglas: ReglasUsoSuelo): ReglaUso | null =>
  wc == null ? null : (reglas.worldcover[String(wc)]?.regla ?? null);

/** Paso 6 (Fase 1): divide la parcela en chunks y les asigna datos locales */
export function construirChunks(anillo: Anillo, f: FuentesLocales): GrillaChunks {
  const celda = tamanoChunk(anillo);
  const lats = anillo.map((p) => p[1]);
  const lons = anillo.map((p) => p[0]);
  const norte = Math.max(...lats);
  const sur = Math.min(...lats);
  const oeste = Math.min(...lons);
  const este = Math.max(...lons);
  const lat0 = (norte + sur) / 2;
  const dlat = celda / M_POR_GRADO;
  const dlon = celda / (M_POR_GRADO * Math.cos((lat0 * Math.PI) / 180));
  const filas = Math.max(1, Math.ceil((norte - sur) / dlat));
  const columnas = Math.max(1, Math.ceil((este - oeste) / dlon));
  const poly = poligonoTurf(anillo);
  const clases = (f.grilla.leyendas?.textura_app as string[] | undefined) ?? [];
  const chunks: Chunk[] = [];

  for (let fila = 0; fila < filas; fila++) {
    for (let columna = 0; columna < columnas; columna++) {
      const lat = norte - (fila + 0.5) * dlat;
      const lon = oeste + (columna + 0.5) * dlon;
      const dentro = booleanPointInPolygon(point([lon, lat]), poly);
      const p = f.parcelas.find((x) => indiceEnParcela(x, lat, lon) != null);
      let ch: Chunk;
      if (p) {
        const i = indiceEnParcela(p, lat, lon)!;
        const c = p.capas;
        const wc = valorCapa(c.worldcover, i);
        ch = {
          fila,
          columna,
          lat,
          lon,
          dentro,
          elevacion_m: valorCapa(c.elevacion_m, i),
          pendiente_grados: valorCapa(c.pendiente_grados, i),
          worldcover: wc,
          regla: c.regla_uso.datos[i] ?? reglaDe(wc, f.reglas),
          arena_pct: valorCapa(c.arena_pct, i),
          arcilla_pct: valorCapa(c.arcilla_pct, i),
          limo_pct: valorCapa(c.limo_pct, i),
          cos_pct: valorCapa(c.cos_pct, i),
          ph: valorCapa(c.ph, i),
          ndvi: valorCapa(c.ndvi_ultimo_anio, i),
          textura: c.textura_app.datos[i] ?? null,
          fuente: '30m',
        };
      } else {
        const g = f.grilla;
        const i = indiceEnGrilla(g, lat, lon);
        const v = (capa: string) => (i == null || !g.capas[capa] ? null : valorCapa(g.capas[capa], i));
        const wc = v('worldcover');
        const t = v('textura_app');
        ch = {
          fila,
          columna,
          lat,
          lon,
          dentro,
          elevacion_m: elevacionBilineal(g, lat, lon),
          pendiente_grados: v('pendiente_grados'),
          worldcover: wc,
          regla: reglaDe(wc, f.reglas),
          arena_pct: v('arena_pct'),
          arcilla_pct: v('arcilla_pct'),
          limo_pct: v('limo_pct'),
          cos_pct: v('cos_pct'),
          ph: v('ph'),
          ndvi: v('ndvi_ultimo_anio'),
          textura: t == null ? null : (clases[t] ?? null),
          fuente: '1km',
        };
      }
      chunks.push(ch);
    }
  }
  return {
    celda_m: celda,
    filas,
    columnas,
    bbox: [oeste, sur, este, norte],
    dlat,
    dlon,
    chunks,
    origen: 'local',
  };
}

export interface ResumenParcela {
  n_dentro: number;
  pct: Record<ReglaUso, number>;
  puede_sembrar: boolean;
  advertencias: string[];
  bloqueos: string[];
  cobertura_pct: Record<string, number>;
  elevacion_media_m: number | null;
  pendiente_media_grados: number | null;
  textura_dominante: string | null;
  ph_medio: number | null;
  /** % de chunks con datos a 30 m */
  pct_30m: number;
}

const media = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Paso 4: ¿es apta? (>50 % bloqueado = no se siembra; advertencias si hay bosque, bofedal, etc.) */
export function resumirParcela(g: GrillaChunks, reglas: ReglasUsoSuelo): ResumenParcela {
  const dentro = g.chunks.filter((c) => c.dentro);
  const n = dentro.length || 1;
  const pct: Record<ReglaUso, number> = { permitido: 0, advertencia: 0, bloqueado: 0 };
  const cobertura: Record<string, number> = {};
  for (const c of dentro) {
    if (c.regla) pct[c.regla] += 100 / n;
    if (c.worldcover != null)
      cobertura[String(c.worldcover)] = (cobertura[String(c.worldcover)] ?? 0) + 100 / n;
  }
  const mensajes = (regla: ReglaUso) =>
    Object.keys(cobertura)
      .filter((k) => reglas.worldcover[k]?.regla === regla)
      .map(
        (k) =>
          `${reglas.worldcover[k].nombre} (${cobertura[k].toFixed(0)} %)${reglas.worldcover[k].mensaje ? ': ' + reglas.worldcover[k].mensaje : ''}`,
      );
  const texturas: Record<string, number> = {};
  for (const c of dentro) if (c.textura) texturas[c.textura] = (texturas[c.textura] ?? 0) + 1;
  const dom = Object.entries(texturas).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  for (const k of Object.keys(pct) as ReglaUso[]) pct[k] = Math.round(pct[k] * 10) / 10;
  for (const k of Object.keys(cobertura)) cobertura[k] = Math.round(cobertura[k] * 10) / 10;
  return {
    n_dentro: dentro.length,
    pct,
    puede_sembrar: dentro.length > 0 && pct.bloqueado <= 50,
    advertencias: mensajes('advertencia'),
    bloqueos: mensajes('bloqueado'),
    cobertura_pct: cobertura,
    elevacion_media_m: media(dentro.map((c) => c.elevacion_m)),
    pendiente_media_grados: media(dentro.map((c) => c.pendiente_grados)),
    textura_dominante: dom,
    ph_medio: media(dentro.map((c) => c.ph)),
    pct_30m: Math.round((100 * dentro.filter((c) => c.fuente !== '1km').length) / n),
  };
}

/** Penalización de los chunks en "advertencia" (supuesto editable del piloto) */
export const PENALIZACION_ADVERTENCIA = 0.85;

/** Aptitud EcoCrop por pH (0-1): 1 en el rango óptimo, lineal hasta 0 en los límites absolutos */
export function aptitudPh(ph: number | null, e: EcoCrop | undefined): number {
  if (ph == null || !e || e.ph_opt_min == null || e.ph_opt_max == null) return 1;
  const min = e.ph_min ?? e.ph_opt_min - 1;
  const max = e.ph_max ?? e.ph_opt_max + 1;
  if (ph >= e.ph_opt_min && ph <= e.ph_opt_max) return 1;
  if (ph < e.ph_opt_min) return Math.max(0, Math.min(1, (ph - min) / (e.ph_opt_min - min || 1)));
  return Math.max(0, Math.min(1, (max - ph) / (max - e.ph_opt_max || 1)));
}

export interface RendimientoChunks {
  /** t/ha por chunk (null fuera de la parcela) */
  porChunk: (number | null)[];
  /** Factor medio de la parcela (uso de suelo × pH) */
  factor_parcela: number;
  rend_parcela_t_ha: number;
  produccion_t: number;
  area_ha: number;
}

/**
 * Paso 11: rendimiento por chunk = rendimiento del escenario × uso de suelo × pH relativo.
 * El rendimiento DRA ya refleja los suelos típicos de la provincia, así que el pH se compara
 * con el del punto de referencia: solo baja el chunk que es menos apto que ese suelo.
 */
export function rendimientoPorChunk(
  g: GrillaChunks,
  rend_t_ha: number,
  eco: EcoCrop | undefined,
  area_ha: number,
  phReferencia: number | null = null,
): RendimientoChunks {
  const aptRef = Math.max(0.05, aptitudPh(phReferencia, eco));
  const porChunk = g.chunks.map((c) => {
    if (!c.dentro) return null;
    if (c.regla === 'bloqueado') return 0;
    const fUso = c.regla === 'advertencia' ? PENALIZACION_ADVERTENCIA : 1;
    const fPh = Math.min(1, aptitudPh(c.ph, eco) / aptRef);
    return Math.round(rend_t_ha * fUso * fPh * 100) / 100;
  });
  const vals = porChunk.filter((x): x is number => x != null);
  const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  return {
    porChunk,
    factor_parcela: rend_t_ha ? Math.round((prom / rend_t_ha) * 1000) / 1000 : 0,
    rend_parcela_t_ha: Math.round(prom * 100) / 100,
    produccion_t: Math.round(prom * area_ha * 100) / 100,
    area_ha,
  };
}

type Geometria = { type: string; coordinates?: unknown; geometries?: Geometria[] };

/** ¿(lat, lon) cae dentro de alguna geometría de un FeatureCollection? (Polygon, MultiPolygon o colección) */
export function enGeojson(
  lat: number,
  lon: number,
  fc: { features: { geometry: unknown; properties: Record<string, unknown> }[] },
): Record<string, unknown> | null {
  const pt = point([lon, lat]);
  const prueba = (g: Geometria | null | undefined): boolean => {
    if (!g) return false;
    if (g.type === 'Polygon' || g.type === 'MultiPolygon')
      return booleanPointInPolygon(pt, g as Parameters<typeof booleanPointInPolygon>[1]);
    if (g.type === 'GeometryCollection') return (g.geometries ?? []).some(prueba);
    return false;
  };
  for (const f of fc.features) if (prueba(f.geometry as Geometria)) return f.properties ?? {};
  return null;
}
