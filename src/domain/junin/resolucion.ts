/**
 * Fase 2 · Fidelidad por tamaño de chunk.
 *
 * Registro de la resolución NATIVA de cada capa (la del sensor o modelo de origen) y de cómo llega
 * a cada chunk. Con eso se dice, chunk por chunk y capa por capa, si el valor es:
 *   - real:          el dato es igual o más fino que el chunk (cada chunk tiene su propia medida);
 *   - remuestreado:  el chunk es más chico que el píxel del dato: hereda (o interpola) el valor de
 *                    un píxel más grande; varios chunks vecinos comparten la misma medida;
 *   - extrapolado:   el valor viene de fuera del alcance del dato (clima de una estación a más
 *                    distancia que el tamaño de su celda).
 * Nada de esto cambia los números: solo dice cuánto confiar en el detalle que se ve.
 */
import type { Chunk, FuenteChunk, GrillaChunks } from './parcela';

export type Fidelidad = 'real' | 'remuestreado' | 'extrapolado';

/** Capas que llegan al chunk */
export type CapaDato =
  'uso_suelo' | 'relieve' | 'pendiente' | 'suelo' | 'ndvi' | 'clima' | 'casas' | 'protegidas';

export interface InfoCapa {
  nombre: string;
  fuente: string;
  /** Resolución nativa en metros; null = vector (contornos exactos) */
  nativa_m: number | null;
  /** Cómo llega a un chunk de la ventana de 30 m (o del servidor) */
  metodo_30m: string;
  /** Cómo llega a un chunk fuera de la ventana (grilla de Junín a 0.01° ≈ 1.1 km) */
  metodo_1km: string;
  /** Qué decide en la app */
  uso: string;
}

/** Celda de la grilla de Junín: 0.01° ≈ 1.1 km en latitud */
export const RES_GRILLA_M = 1_000;
/** Ventana de 30 m (parcelas de 40 × 40 celdas) y servidor (TIF a 30 m) */
export const RES_VENTANA_M = 30;

export const CAPAS: Record<CapaDato, InfoCapa> = {
  uso_suelo: {
    nombre: 'Uso de suelo',
    fuente: 'ESA WorldCover v200 (2021)',
    nativa_m: 10,
    metodo_30m: 'clase más frecuente en 30 m',
    metodo_1km: 'clase más frecuente en ~1 km',
    uso: 'apta / advertencia / bloqueo de cada chunk',
  },
  relieve: {
    nombre: 'Altura',
    fuente: 'SRTM (NASA)',
    nativa_m: 90,
    metodo_30m: 'interpolación bilineal',
    metodo_1km: 'promedio de ~1 km, interpolado',
    uso: 'relieve 3D y piso ecológico',
  },
  pendiente: {
    nombre: 'Pendiente',
    fuente: 'derivada de SRTM',
    nativa_m: 90,
    metodo_30m: 'valor de la celda de 30 m',
    metodo_1km: 'pendiente media de ~1 km',
    uso: 'advertencias de pendiente',
  },
  suelo: {
    nombre: 'Suelo (textura, pH, MO)',
    fuente: 'SoilGrids 2.0 (ISRIC), 0-30 cm',
    nativa_m: 250,
    metodo_30m: 'vecino más cercano',
    metodo_1km: 'valor de ~1 km',
    uso: 'aptitud por pH y suelo del simulador 3D',
  },
  ndvi: {
    nombre: 'NDVI',
    fuente: 'Sentinel-2 SR, compuesto mensual a 250 m',
    nativa_m: 250,
    metodo_30m: 'vecino más cercano',
    metodo_1km: 'promedio de ~1 km',
    uso: 'solo informativo',
  },
  clima: {
    nombre: 'Clima (lluvia, ET0, temperatura)',
    fuente: 'ERA5-Land 0.1° + PISCO v3 0.1° en 10 puntos',
    nativa_m: 10_000,
    metodo_30m: 'serie del punto con datos más cercano',
    metodo_1km: 'serie del punto con datos más cercano',
    uso: 'rendimiento (un solo clima para toda la parcela)',
  },
  casas: {
    nombre: 'Casas',
    fuente: 'OpenStreetMap (en vivo)',
    nativa_m: null,
    metodo_30m: 'contorno exacto + margen',
    metodo_1km: 'contorno exacto + margen',
    uso: 'bloqueo',
  },
  protegidas: {
    nombre: 'Áreas protegidas',
    fuente: 'WDPA (UNEP-WCMC), incluye las ANP del SERNANP',
    nativa_m: null,
    metodo_30m: 'contorno exacto',
    metodo_1km: 'contorno exacto',
    uso: 'bloqueo',
  },
};

/** Capas que varían chunk a chunk y entran en la "peor" fidelidad del chunk */
export const CAPAS_POR_CHUNK: CapaDato[] = ['uso_suelo', 'relieve', 'suelo'];

const ORDEN: Record<Fidelidad, number> = { real: 0, remuestreado: 1, extrapolado: 2 };

/**
 * Resolución con la que la capa realmente distingue un lugar en un chunk de esa fuente:
 * nunca más fina que la nativa (remuestrear a 30 m no agrega detalle) ni que la grilla usada.
 */
export function resolucionEfectiva(capa: CapaDato, fuente: FuenteChunk): number | null {
  const nativa = CAPAS[capa].nativa_m;
  if (nativa == null) return null;
  if (capa === 'clima') return nativa;
  return Math.max(nativa, fuente === '1km' ? RES_GRILLA_M : RES_VENTANA_M);
}

export interface FidelidadCapa {
  capa: CapaDato;
  res_m: number | null;
  fidelidad: Fidelidad;
  /** Cuántas veces el dato es más grande que el chunk (1 = igual o más fino) */
  factor: number;
}

/**
 * Fidelidad de una capa en un chunk de `celda_m` metros.
 * El clima pasa a "extrapolado" cuando el punto con datos está más lejos que su celda (10 km).
 */
export function fidelidadCapa(
  capa: CapaDato,
  fuente: FuenteChunk,
  celda_m: number,
  distanciaClimaM?: number,
): FidelidadCapa {
  const res = resolucionEfectiva(capa, fuente);
  if (res == null) return { capa, res_m: null, fidelidad: 'real', factor: 1 };
  const factor = Math.max(1, res / celda_m);
  if (capa === 'clima' && distanciaClimaM != null && distanciaClimaM > res)
    return { capa, res_m: res, fidelidad: 'extrapolado', factor };
  return { capa, res_m: res, fidelidad: res <= celda_m ? 'real' : 'remuestreado', factor };
}

/** La más baja de las capas que varían por chunk (uso de suelo, relieve y suelo). Sin dato → null */
export function fidelidadChunk(
  c: Chunk,
  celda_m: number,
  capa: CapaDato | 'peor' = 'peor',
  distanciaClimaM?: number,
): Fidelidad | null {
  if (c.estado === 'sin_dato' || !c.dentro) return null;
  if (capa !== 'peor') return fidelidadCapa(capa, c.fuente, celda_m, distanciaClimaM).fidelidad;
  return CAPAS_POR_CHUNK.map((k) => fidelidadCapa(k, c.fuente, celda_m).fidelidad).reduce((a, b) =>
    ORDEN[b] > ORDEN[a] ? b : a,
  );
}

export interface FilaResolucion {
  capa: CapaDato;
  nombre: string;
  fuente: string;
  nativa_m: number | null;
  /** Resolución efectiva por fuente, con el % del área con datos que la usa */
  efectiva: { res_m: number | null; pct: number; metodo: string }[];
  /** % del área con datos en cada fidelidad */
  pct: Record<Fidelidad, number>;
  /** Fidelidad que cubre más área */
  dominante: Fidelidad;
  /** Mayor factor dato/chunk (cuántos chunks comparten un mismo valor por lado) */
  factor_max: number;
  uso: string;
}

export interface ResumenResolucion {
  celda_m: number;
  filas: FilaResolucion[];
  /** Lo más fino que distingue la parcela: la capa por chunk con menor resolución efectiva */
  efectiva_m: number;
  capa_efectiva: CapaDato;
  /** % del área con datos donde el chunk es más fino que todos sus datos */
  pct_remuestreado: number;
  advertencias: string[];
}

const redondear = (x: number) => Math.round(x * 10) / 10;

/** Resumen "Resolución efectiva" de la parcela (área ponderada por la fracción dentro del polígono) */
export function resumirResolucion(g: GrillaChunks, distanciaClimaM: number): ResumenResolucion {
  const celda = g.celda_m;
  const conDato = g.chunks.filter((c) => c.dentro && c.estado !== 'sin_dato');
  const areaTot = conDato.reduce((s, c) => s + c.fraccion, 0) || 1;
  const pctFuente = (f: FuenteChunk) =>
    (conDato.filter((c) => c.fuente === f).reduce((s, c) => s + c.fraccion, 0) / areaTot) * 100;
  const fuentes = (['30m', 'servidor', '1km'] as FuenteChunk[])
    .map((f) => ({ f, pct: pctFuente(f) }))
    .filter((x) => x.pct > 0);
  if (!fuentes.length) fuentes.push({ f: '30m', pct: 100 });

  const filas: FilaResolucion[] = (Object.keys(CAPAS) as CapaDato[]).map((capa) => {
    const info = CAPAS[capa];
    const pct: Record<Fidelidad, number> = { real: 0, remuestreado: 0, extrapolado: 0 };
    let factor_max = 1;
    const efectiva = fuentes.map(({ f, pct: p }) => {
      const fc = fidelidadCapa(capa, f, celda, distanciaClimaM);
      pct[fc.fidelidad] += p;
      factor_max = Math.max(factor_max, fc.factor);
      return {
        res_m: fc.res_m,
        pct: redondear(p),
        metodo: f === '1km' ? info.metodo_1km : info.metodo_30m,
      };
    });
    // misma resolución desde dos fuentes: se juntan
    const juntas = efectiva.reduce<typeof efectiva>((acc, e) => {
      const igual = acc.find((x) => x.res_m === e.res_m);
      if (igual) igual.pct = redondear(igual.pct + e.pct);
      else acc.push({ ...e });
      return acc;
    }, []);
    (Object.keys(pct) as Fidelidad[]).forEach((k) => (pct[k] = redondear(pct[k])));
    const dominante = (Object.keys(pct) as Fidelidad[]).reduce((a, b) => (pct[b] > pct[a] ? b : a));
    return {
      capa,
      nombre: info.nombre,
      fuente: info.fuente,
      nativa_m: info.nativa_m,
      efectiva: juntas,
      pct,
      dominante,
      factor_max: Math.round(factor_max),
      uso: info.uso,
    };
  });

  // Lo más fino que realmente distingue un chunk de otro (en la fuente que cubre más área)
  const principal = fuentes.reduce((a, b) => (b.pct > a.pct ? b : a)).f;
  const [capa_efectiva, efectiva_m] = CAPAS_POR_CHUNK.map(
    (k) => [k, resolucionEfectiva(k, principal) ?? Infinity] as const,
  ).reduce((a, b) => (b[1] < a[1] ? b : a));
  const pctRem =
    (conDato
      .filter((c) => fidelidadChunk(c, celda, capa_efectiva) !== 'real')
      .reduce((s, c) => s + c.fraccion, 0) /
      areaTot) *
    100;

  const advertencias: string[] = [];
  if (celda < efectiva_m)
    advertencias.push(
      `Tus chunks de ${celda} m son ${Math.round(efectiva_m / celda)} veces más finos que el dato más fino (${CAPAS[capa_efectiva].nombre.toLowerCase()} a ${efectiva_m} m): sirven para seguir la forma de la parcela, medir el área y ubicar surcos, pero no agregan información.`,
    );
  const suelo = filas.find((f) => f.capa === 'suelo')!;
  if (suelo.factor_max > 1)
    advertencias.push(
      `El suelo (pH, textura) viene de píxeles de ${suelo.efectiva.map((e) => `${e.res_m} m`).join(' / ')}: hasta ${suelo.factor_max} × ${suelo.factor_max} chunks comparten el mismo valor.`,
    );
  const clima = filas.find((f) => f.capa === 'clima')!;
  advertencias.push(
    clima.dominante === 'extrapolado'
      ? `El clima es el del punto con datos a ${(distanciaClimaM / 1000).toFixed(1)} km, más lejos que su celda de ~10 km: es extrapolado e igual para toda la parcela.`
      : `El clima (celda de ~10 km) es el mismo para toda la parcela.`,
  );
  return {
    celda_m: celda,
    filas,
    efectiva_m,
    capa_efectiva,
    pct_remuestreado: redondear(pctRem),
    advertencias,
  };
}
