/**
 * Fase 1 · Estado de cada chunk y área exacta dentro del polígono.
 *
 * Regla de oro: no se inventan datos. Un chunk sin altura, suelo o cobertura, o con el clima
 * de una estación demasiado lejana, queda "sin_dato": no se dibuja como terreno, no entra en
 * promedios ni en el rendimiento. Lo que no se puede sembrar queda "bloqueado" con su motivo.
 *
 *   con_dato     dato a 30 m (ventanas de 30 m o servidor) completo
 *   interpolado  dato de la grilla de ~1 km (completo, pero más grueso)
 *   sin_dato     falta altura, suelo, cobertura o clima cercano
 *   bloqueado    ciudad, agua, nieve u otra cobertura bloqueada, área natural protegida o casa
 */
import type { ReglasUsoSuelo } from '@/data/junin/types';
import type { Anillo, Chunk, GrillaChunks } from './parcela';

export type EstadoChunk = 'con_dato' | 'interpolado' | 'sin_dato' | 'bloqueado';
export type MotivoBloqueo = 'cobertura' | 'area_protegida' | 'casa';

/** Distancia máxima a la estación con datos de clima; más lejos el chunk queda sin dato (configurable) */
export const MAX_DIST_DATO_M = 50_000;
/** Si menos de este % del área no bloqueada tiene datos, el resultado no se da como confiable */
export const UMBRAL_COBERTURA_PCT = 50;
/** Margen alrededor de cada casa (m) */
export const MARGEN_CASA_M = 5;

const M_POR_GRADO = 111_320;

export interface ClasificacionChunk {
  estado: EstadoChunk;
  motivo: string | null;
  bloqueo: MotivoBloqueo | null;
}

export interface BanderasChunk {
  /** Nombre del área natural protegida que contiene al chunk, o null */
  areaProtegida: string | null;
  /** El chunk está sobre una casa (o a menos de MARGEN_CASA_M) */
  enCasa: boolean;
  /** Distancia (m) de la parcela a la estación de clima; null si no se conoce */
  distanciaClimaM: number | null;
}

/** Clasificador puro (probado en junin.test.ts). El orden importa: primero lo bloqueado. */
export function clasificarChunk(c: Chunk, b: BanderasChunk, reglas: ReglasUsoSuelo): ClasificacionChunk {
  if (b.enCasa)
    return {
      estado: 'bloqueado',
      bloqueo: 'casa',
      motivo: `Casa o edificación (OpenStreetMap) a menos de ${MARGEN_CASA_M} m.`,
    };
  if (b.areaProtegida)
    return {
      estado: 'bloqueado',
      bloqueo: 'area_protegida',
      motivo: `Área natural protegida: ${b.areaProtegida}.`,
    };
  if (c.regla === 'bloqueado') {
    const r = reglas.worldcover[String(c.worldcover)];
    return {
      estado: 'bloqueado',
      bloqueo: 'cobertura',
      motivo: r ? `${r.nombre}: ${r.mensaje}` : 'Cobertura donde no se puede sembrar.',
    };
  }
  const faltan: string[] = [];
  if (c.elevacion_m == null) faltan.push('altura');
  if (c.arena_pct == null || c.arcilla_pct == null || c.limo_pct == null || c.ph == null || c.cos_pct == null)
    faltan.push('suelo');
  if (c.worldcover == null) faltan.push('cobertura');
  if (b.distanciaClimaM != null && b.distanciaClimaM > MAX_DIST_DATO_M) faltan.push('clima');
  if (faltan.length) {
    const lejos =
      faltan.includes('clima') && b.distanciaClimaM != null
        ? ` (estación de clima a ${(b.distanciaClimaM / 1000).toFixed(0)} km; máximo ${MAX_DIST_DATO_M / 1000} km)`
        : '';
    return { estado: 'sin_dato', bloqueo: null, motivo: `Sin dato de ${faltan.join(', ')}${lejos}.` };
  }
  return { estado: c.fuente === '1km' ? 'interpolado' : 'con_dato', bloqueo: null, motivo: null };
}

export const usable = (c: Chunk): boolean =>
  c.fraccion > 0 && (c.estado === 'con_dato' || c.estado === 'interpolado');

// ---------------------------------------------------------------------------
// Geometría en metros locales
// ---------------------------------------------------------------------------
interface Proyeccion {
  x: (lon: number) => number;
  y: (lat: number) => number;
}

function proyeccion(lat0: number, lon0: number): Proyeccion {
  const mx = M_POR_GRADO * Math.cos((lat0 * Math.PI) / 180);
  return { x: (lon) => (lon - lon0) * mx, y: (lat) => (lat - lat0) * M_POR_GRADO };
}

type P = [number, number];

const areaShoelace = (p: P[]): number => {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(s) / 2;
};

/** Sutherland-Hodgman: recorta el polígono (puede ser cóncavo) con un rectángulo alineado */
function recortar(poly: P[], x0: number, y0: number, x1: number, y1: number): P[] {
  const lado = (pts: P[], dentro: (p: P) => boolean, corte: (a: P, b: P) => P): P[] => {
    const out: P[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length];
      const b = pts[i];
      const ia = dentro(a);
      const ib = dentro(b);
      if (ib) {
        if (!ia) out.push(corte(a, b));
        out.push(b);
      } else if (ia) out.push(corte(a, b));
    }
    return out;
  };
  const enX = (a: P, b: P, x: number): P => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1e-12)];
  const enY = (a: P, b: P, y: number): P => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1e-12), y];
  let r = poly;
  r = lado(
    r,
    (p) => p[0] >= x0,
    (a, b) => enX(a, b, x0),
  );
  if (!r.length) return r;
  r = lado(
    r,
    (p) => p[0] <= x1,
    (a, b) => enX(a, b, x1),
  );
  if (!r.length) return r;
  r = lado(
    r,
    (p) => p[1] >= y0,
    (a, b) => enY(a, b, y0),
  );
  if (!r.length) return r;
  return lado(
    r,
    (p) => p[1] <= y1,
    (a, b) => enY(a, b, y1),
  );
}

/** Fracción (0-1) del área de cada chunk que cae dentro del polígono */
export function fraccionesEnPoligono(g: GrillaChunks, anillo: Anillo): number[] {
  const [oeste, , , norte] = g.bbox;
  const pr = proyeccion(norte, oeste);
  const poly: P[] = anillo.map(([lon, lat]) => [pr.x(lon), pr.y(lat)]);
  const celda = g.celda_m;
  return g.chunks.map((c) => {
    const lonW = oeste + c.columna * g.dlon;
    const latN = norte - c.fila * g.dlat;
    const x0 = pr.x(lonW);
    const x1 = pr.x(lonW + g.dlon);
    const y1 = pr.y(latN);
    const y0 = pr.y(latN - g.dlat);
    const parte = recortar(poly, x0, y0, x1, y1);
    if (parte.length < 3) return 0;
    const f = areaShoelace(parte) / ((x1 - x0) * (y1 - y0) || celda * celda);
    return Math.min(1, Math.round(f * 1000) / 1000);
  });
}

// ---------------------------------------------------------------------------
// Polígonos indexados (áreas protegidas y casas)
// ---------------------------------------------------------------------------
export interface PoligonoIndexado {
  nombre: string;
  bbox: [number, number, number, number];
  /** anillos [lon, lat]: el primero es el exterior, los siguientes son huecos */
  anillos: [number, number][][];
}

type Geom = { type: string; coordinates?: unknown; geometries?: Geom[] };

export function indexarPoligonos(
  fc: { features: { geometry: unknown; properties: Record<string, unknown> }[] },
  nombre: (p: Record<string, unknown>) => string,
): PoligonoIndexado[] {
  const out: PoligonoIndexado[] = [];
  const agregar = (anillos: [number, number][][], props: Record<string, unknown>) => {
    const ext = anillos[0];
    if (!ext?.length) return;
    const xs = ext.map((p) => p[0]);
    const ys = ext.map((p) => p[1]);
    out.push({
      nombre: nombre(props),
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      anillos,
    });
  };
  const recorrer = (g: Geom | null | undefined, props: Record<string, unknown>) => {
    if (!g) return;
    if (g.type === 'Polygon') agregar(g.coordinates as [number, number][][], props);
    else if (g.type === 'MultiPolygon')
      for (const p of g.coordinates as [number, number][][][]) agregar(p, props);
    else if (g.type === 'GeometryCollection') for (const h of g.geometries ?? []) recorrer(h, props);
  };
  for (const f of fc.features) recorrer(f.geometry as Geom, f.properties ?? {});
  return out;
}

function enAnillo(lon: number, lat: number, a: [number, number][]): boolean {
  let d = false;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i];
    const [xj, yj] = a[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-15) + xi) d = !d;
  }
  return d;
}

export function enPoligono(lon: number, lat: number, p: PoligonoIndexado): boolean {
  const [w, s, e, n] = p.bbox;
  if (lon < w || lon > e || lat < s || lat > n) return false;
  if (!enAnillo(lon, lat, p.anillos[0])) return false;
  for (let k = 1; k < p.anillos.length; k++) if (enAnillo(lon, lat, p.anillos[k])) return false;
  return true;
}

/** Distancia (m) de un punto al borde de un polígono (0 si está dentro) */
function distanciaAPoligono(lon: number, lat: number, p: PoligonoIndexado): number {
  if (enPoligono(lon, lat, p)) return 0;
  const pr = proyeccion(lat, lon);
  let min = Infinity;
  for (const a of p.anillos) {
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const ax = pr.x(a[j][0]);
      const ay = pr.y(a[j][1]);
      const bx = pr.x(a[i][0]);
      const by = pr.y(a[i][1]);
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1e-12)));
      min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return min;
}

// ---------------------------------------------------------------------------
// Preparación de la grilla: fracción, banderas y estado de cada chunk
// ---------------------------------------------------------------------------
export interface ContextoChunks {
  reglas: ReglasUsoSuelo;
  distanciaClimaM?: number | null;
  protegidas?: PoligonoIndexado[];
  /** Contornos de casas [lon, lat] (OpenStreetMap) */
  casas?: Anillo[];
}

export function prepararChunks(g: GrillaChunks, anillo: Anillo, ctx: ContextoChunks): GrillaChunks {
  const fr = fraccionesEnPoligono(g, anillo);
  const [w, s, e, n] = g.bbox;
  const margenLat = MARGEN_CASA_M / M_POR_GRADO;
  const margenLon = margenLat / Math.cos((((s + n) / 2) * Math.PI) / 180);
  const protegidas = (ctx.protegidas ?? []).filter(
    (p) => !(p.bbox[2] < w || p.bbox[0] > e || p.bbox[3] < s || p.bbox[1] > n),
  );
  const casas: PoligonoIndexado[] = (ctx.casas ?? [])
    .map((a) => {
      const xs = a.map((p) => p[0]);
      const ys = a.map((p) => p[1]);
      return {
        nombre: 'casa',
        bbox: [
          Math.min(...xs) - margenLon,
          Math.min(...ys) - margenLat,
          Math.max(...xs) + margenLon,
          Math.max(...ys) + margenLat,
        ] as [number, number, number, number],
        anillos: [a],
      };
    })
    .filter((p) => !(p.bbox[2] < w || p.bbox[0] > e || p.bbox[3] < s || p.bbox[1] > n));

  const chunks = g.chunks.map((c, i) => {
    const fraccion = fr[i];
    const base = { ...c, fraccion, dentro: fraccion > 0 };
    if (!base.dentro)
      return { ...base, estado: 'sin_dato' as EstadoChunk, motivo: 'Fuera de la parcela.', bloqueo: null };
    const prot = protegidas.find((p) => enPoligono(c.lon, c.lat, p));
    const enCasa = casas.some((p) => {
      const [bw, bs, be, bn] = p.bbox;
      if (c.lon < bw || c.lon > be || c.lat < bs || c.lat > bn) return false;
      return distanciaAPoligono(c.lon, c.lat, { ...p, bbox: [-180, -90, 180, 90] }) <= MARGEN_CASA_M;
    });
    return {
      ...base,
      ...clasificarChunk(
        base,
        { areaProtegida: prot?.nombre ?? null, enCasa, distanciaClimaM: ctx.distanciaClimaM ?? null },
        ctx.reglas,
      ),
    };
  });
  return { ...g, chunks };
}
