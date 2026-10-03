/**
 * Casas y edificaciones EN VIVO desde OpenStreetMap (Overpass API), para la parcela dibujada.
 * Si la consulta falla o tarda demasiado, se informa: nunca se asume "no hay casas" en silencio.
 * Limitación: en el campo de Junín OSM tiene pocas casas mapeadas; la UI lo dice.
 */
import { MARGEN_CASA_M } from '@/domain/junin/estadoChunk';
import type { Anillo } from '@/domain/junin/parcela';

const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
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
      fuente: 'OpenStreetMap (Overpass)',
      consultado: ahora,
      latencia_ms: 0,
      mensaje: `Parcela de más de ${LADO_MAX_CONSULTA_KM} km de lado: no se verificaron casas.`,
    };
  const q = `[out:json][timeout:12];(way["building"](${s},${w},${n},${e});relation["building"](${s},${w},${n},${e}););out geom;`;
  const t0 = performance.now();
  let ultimoError = '';
  for (const url of SERVIDORES) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: q }),
        signal: AbortSignal.timeout(TIEMPO_MAX_MS),
      });
      if (!r.ok) throw new Error(`respuesta ${r.status}`);
      const casas = parsearOverpass(await r.json());
      const res: ResultadoCasas = {
        estado: 'ok',
        casas,
        fuente: 'OpenStreetMap (Overpass)',
        consultado: ahora,
        latencia_ms: Math.round(performance.now() - t0),
        mensaje: casas.length
          ? `${casas.length} casa(s) o edificación(es) en OpenStreetMap; se bloquean con ${MARGEN_CASA_M} m de margen.`
          : 'OpenStreetMap no tiene casas registradas aquí (en zonas rurales puede faltar alguna: revisa la imagen).',
      };
      cache.set(clave, res);
      return res;
    } catch (err) {
      ultimoError = (err as Error).message;
    }
  }
  return {
    estado: 'error',
    casas: [],
    fuente: 'OpenStreetMap (Overpass)',
    consultado: ahora,
    latencia_ms: Math.round(performance.now() - t0),
    mensaje: `No se pudo consultar OpenStreetMap (${ultimoError}): las casas NO se verificaron.`,
  };
}
