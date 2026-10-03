/**
 * Casas y edificaciones EN VIVO desde OpenStreetMap para la parcela dibujada.
 * Primero la API oficial de OSM (/api/0.6/map, respondió en ~1 s en pruebas desde Chrome);
 * si falla (p. ej. zona con demasiados datos), Overpass como respaldo.
 * Si la consulta falla o tarda demasiado, se informa: nunca se asume "no hay casas" en silencio.
 * Limitación: en el campo de Junín OSM tiene pocas casas mapeadas; la UI lo dice.
 */
import { MARGEN_CASA_M } from '@/domain/junin/estadoChunk';
import type { Anillo } from '@/domain/junin/parcela';

const API_OSM = 'https://api.openstreetmap.org/api/0.6/map';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const TIEMPO_MAX_MS = 15_000;
/** Lado máximo de la caja a consultar (km): más grande y Overpass se vuelve lento */
export const LADO_MAX_CONSULTA_KM = 5;

export interface ResultadoCasas {
  estado: 'ok' | 'error' | 'omitido';
  casas: Anillo[];
  fuente: string;
  consultado: string;
  mensaje: string;
  latencia_ms: number;
}

const cache = new Map<string, ResultadoCasas>();

interface ElementoOverpass {
  type: string;
  geometry?: { lat: number; lon: number }[];
  members?: { role: string; geometry?: { lat: number; lon: number }[] }[];
}

export function parsearOverpass(json: { elements?: ElementoOverpass[] }): Anillo[] {
  const out: Anillo[] = [];
  for (const e of json.elements ?? []) {
    if (e.type === 'way' && e.geometry && e.geometry.length >= 3)
      out.push(e.geometry.map((p) => [p.lon, p.lat] as [number, number]));
    if (e.type === 'relation')
      for (const m of e.members ?? [])
        if (m.role === 'outer' && m.geometry && m.geometry.length >= 3)
          out.push(m.geometry.map((p) => [p.lon, p.lat] as [number, number]));
  }
  return out;
}

/** XML de /api/0.6/map → contornos de las vías (ways) y relaciones con la etiqueta building */
export function parsearOsmXml(xml: string): Anillo[] {
  const nodos = new Map<string, [number, number]>();
  for (const m of xml.matchAll(/<node\b([^>]*)>/g)) {
    const a = m[1];
    const id = /\bid="(\d+)"/.exec(a)?.[1];
    const lat = /\blat="([-\d.]+)"/.exec(a)?.[1];
    const lon = /\blon="([-\d.]+)"/.exec(a)?.[1];
    if (id && lat && lon) nodos.set(id, [Number(lon), Number(lat)]);
  }
  const vias = new Map<string, { refs: string[]; edificio: boolean }>();
  for (const m of xml.matchAll(/<way\b[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((r) => r[1]);
    vias.set(m[1], { refs, edificio: /<tag k="building"/.test(m[2]) });
  }
  const anillo = (refs: string[]): Anillo =>
    refs.map((r) => nodos.get(r)).filter((p): p is [number, number] => !!p);
  const out: Anillo[] = [];
  for (const v of vias.values()) if (v.edificio && v.refs.length >= 4) out.push(anillo(v.refs));
  for (const m of xml.matchAll(/<relation\b[^>]*>([\s\S]*?)<\/relation>/g)) {
    if (!/<tag k="building"/.test(m[1])) continue;
    for (const mm of m[1].matchAll(/<member type="way" ref="(\d+)" role="outer"/g)) {
      const v = vias.get(mm[1]);
      if (v && v.refs.length >= 4) out.push(anillo(v.refs));
    }
  }
  return out.filter((a) => a.length >= 3);
}

/** bbox = [oeste, sur, este, norte]; se agrega un margen para casas que tocan el borde */
export async function casasEnVivo(bbox: [number, number, number, number]): Promise<ResultadoCasas> {
  const [w0, s0, e0, n0] = bbox;
  const m = 0.0001; // ~11 m
  const [w, s, e, n] = [w0 - m, s0 - m, e0 + m, n0 + m];
  const clave = [w, s, e, n].map((x) => x.toFixed(5)).join(',');
  const enCache = cache.get(clave);
  if (enCache && enCache.estado === 'ok') return enCache;
  const ahora = new Date().toISOString();
  const ladoKm = Math.max((n - s) * 111.32, (e - w) * 111.32 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  if (ladoKm > LADO_MAX_CONSULTA_KM)
    return {
      estado: 'omitido',
      casas: [],
      fuente: 'OpenStreetMap',
      consultado: ahora,
      latencia_ms: 0,
      mensaje: `Parcela de más de ${LADO_MAX_CONSULTA_KM} km de lado: no se verificaron casas.`,
    };
  const t0 = performance.now();
  const listo = (casas: Anillo[], fuente: string): ResultadoCasas => {
    const res: ResultadoCasas = {
      estado: 'ok',
      casas,
      fuente,
      consultado: ahora,
      latencia_ms: Math.round(performance.now() - t0),
      mensaje: casas.length
        ? `${casas.length} casa(s) o edificación(es) en OpenStreetMap; se bloquean con ${MARGEN_CASA_M} m de margen.`
        : 'OpenStreetMap no tiene casas registradas aquí (en zonas rurales puede faltar alguna: revisa la imagen).',
    };
    cache.set(clave, res);
    return res;
  };
  let ultimoError: string;
  try {
    const r = await fetch(`${API_OSM}?bbox=${w},${s},${e},${n}`, {
      signal: AbortSignal.timeout(TIEMPO_MAX_MS),
    });
    if (!r.ok) throw new Error(`API OSM respondió ${r.status}`);
    return listo(parsearOsmXml(await r.text()), 'OpenStreetMap (API oficial)');
  } catch (err) {
    ultimoError = (err as Error).message;
  }
  try {
    const q = `[out:json][timeout:12];(way["building"](${s},${w},${n},${e});relation["building"](${s},${w},${n},${e}););out geom;`;
    const r = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(TIEMPO_MAX_MS),
    });
    if (!r.ok) throw new Error(`Overpass respondió ${r.status}`);
    return listo(parsearOverpass(await r.json()), 'OpenStreetMap (Overpass)');
  } catch (err) {
    ultimoError += ` · ${(err as Error).message}`;
  }
  return {
    estado: 'error',
    casas: [],
    fuente: 'OpenStreetMap',
    consultado: ahora,
    latencia_ms: Math.round(performance.now() - t0),
    mensaje: `No se pudo consultar OpenStreetMap (${ultimoError}): las casas NO se verificaron.`,
  };
}
