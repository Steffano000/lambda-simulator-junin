/**
 * Paso 07 · Distribución espacial de la mezcla de suelos por la grilla.
 *
 * La mezcla dice QUÉ tanto; la distribución dice DÓNDE. Son estrategias intercambiables
 * (patrón Strategy de docs/07) sobre el mismo contrato: misma mezcla + misma semilla →
 * mismo mapa, siempre.
 *
 *   - `manchas`: cupos exactos por clase (los porcentajes se cumplen al %) que se rellenan
 *     creciendo desde celdas contiguas, así el suelo aparece en zonas como en el campo.
 *   - `aleatorio`: sorteo independiente por celda, sin zonas. Sirve de referencia para
 *     contrastar el efecto de las manchas.
 *
 * El resultado va indexado como `z * cols + x`, el mismo orden que arma la grilla.
 */
import type { GridConfig } from '../grid';
import { createRng } from '../shared/random';
import type { ParteMezcla, SoilMix } from './soilMix';

export type ClaveDistribucion = 'manchas' | 'aleatorio';

/** Reparto de clases de la grilla, indexado `z * cols + x`. */
export type RepartoSuelos = string[];

export interface DistribucionSuelos {
  (mezcla: SoilMix, config: GridConfig, seed: number): RepartoSuelos;
}

/** Vecindad cardinal: la celda y sus cuatro vecinas. */
export const VENTANA = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Sorteo por porcentaje: el que gana es el de mayor peso acumulado. */
export const POR_ALEATORIO: DistribucionSuelos = (mezcla, config, seed) => {
  const partes = mezcla.partes();
  const total = partes.reduce((a, p) => a + p.porcentaje, 0);
  const rng = createRng(seed);
  const out: RepartoSuelos = new Array(config.rows * config.cols);

  for (let i = 0; i < out.length; i++) {
    let sorteo = rng() * total;
    let clase = partes[partes.length - 1].clase;
    for (const p of partes) {
      sorteo -= p.porcentaje;
      if (sorteo <= 0) {
        clase = p.clase;
        break;
      }
    }
    out[i] = clase;
  }
  return out;
};

/**
 * Celdas exactas por clase (método del resto mayor): los porcentajes de la mezcla se
 * cumplen sin depender del azar, y el reparto siempre llena la grilla.
 */
export function cuotasDe(partes: readonly ParteMezcla[], celdas: number): { clase: string; cuota: number }[] {
  const quotas = partes.map((p) => {
    const exacta = (p.porcentaje / 100) * celdas;
    return { clase: p.clase, exacta, cuota: Math.floor(exacta) };
  });
  const faltantes = celdas - quotas.reduce((a, q) => a + q.cuota, 0);
  const porResto = [...quotas].sort((a, b) => b.exacta - b.cuota - (a.exacta - a.cuota));
  for (let i = 0; i < faltantes; i++) porResto[i % porResto.length].cuota++;
  return quotas;
}

/** Vecinas cardinales de la celda `i` dentro de la grilla. */
function vecinas(i: number, cols: number, rows: number): number[] {
  const x = i % cols;
  const z = (i - x) / cols;
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < cols - 1) out.push(i + 1);
  if (z > 0) out.push(i - cols);
  if (z < rows - 1) out.push(i + cols);
  return out;
}

/**
 * Reparto por porcentajes con manchones: cada clase recibe su cupo exacto de celdas y
 * ocupa su cupo creciendo desde celdas contiguas, así el suelo sale en zonas y no en
 * sprinkle de celdas sueltas. Las clases grandes se reparten primero y las pequeñas
 * rellenan los huecos que quedan entre ellas.
 */
export const POR_MANCHAS: DistribucionSuelos = (mezcla, config, seed) => {
  const { rows, cols } = config;
  const celdas = rows * cols;
  const rng = createRng(seed);
  const reparto: RepartoSuelos = new Array(celdas);

  const libre = new Set<number>();
  for (let i = 0; i < celdas; i++) libre.add(i);

  // Reserva barajada para cuando una clase queda encerrada y no tiene dónde crecer.
  const reserva = [...libre];
  for (let i = reserva.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    const tmp = reserva[i];
    reserva[i] = reserva[k];
    reserva[k] = tmp;
  }
  let cursor = 0;

  for (const { clase, cuota } of cuotasDe(mezcla.partes(), celdas)) {
    if (cuota <= 0) continue;

    // Frontera: celdas libres pegadas a lo ya repartido, de donde puede crecer la clase.
    const frontera: number[] = [];
    const enFrontera = new Set<number>();
    for (const i of libre) {
      if (vecinas(i, cols, rows).some((j) => !libre.has(j))) {
        frontera.push(i);
        enFrontera.add(i);
      }
    }

    for (let n = 0; n < cuota; n++) {
      let destino = -1;
      while (frontera.length > 0 && destino < 0) {
        const k = Math.floor(rng() * frontera.length);
        const candidato = frontera[k];
        const ultimo = frontera.pop() as number;
        if (k < frontera.length) frontera[k] = ultimo;
        enFrontera.delete(candidato);
        if (libre.has(candidato)) destino = candidato;
      }
      if (destino < 0) {
        while (cursor < reserva.length && !libre.has(reserva[cursor])) cursor++;
        destino = reserva[cursor] ?? -1;
      }
      if (destino < 0) break;

      reparto[destino] = clase;
      libre.delete(destino);
      for (const v of vecinas(destino, cols, rows)) {
        if (libre.has(v) && !enFrontera.has(v)) {
          enFrontera.add(v);
          frontera.push(v);
        }
      }
    }
  }
  return reparto;
};

/** Registry de estrategias (docs/07: Strategy + Registry). */
export const builders: Record<ClaveDistribucion, DistribucionSuelos> = {
  manchas: POR_MANCHAS,
  aleatorio: POR_ALEATORIO,
};

export const DISTRIBUCIONES: Record<ClaveDistribucion, { etiqueta: string; ayuda: string }> = {
  manchas: {
    etiqueta: 'Manchas',
    ayuda: 'Zonas de celdas contiguas: el suelo cambia por parches, como en el campo.',
  },
  aleatorio: {
    etiqueta: 'Aleatorio',
    ayuda: 'Sorteo celda por celda, sin zonas: solo los porcentajes.',
  },
};

export const DISTRIBUCION_POR_DEFECTO: ClaveDistribucion = 'manchas';

export function repartirSuelos(
  mezcla: SoilMix,
  config: GridConfig,
  clave: ClaveDistribucion = DISTRIBUCION_POR_DEFECTO,
  seed = config.seed,
): RepartoSuelos {
  return builders[clave](mezcla, config, seed);
}

/** Porcentaje real de cada clase en un reparto (para contrastar con la mezcla). */
export function repartoReal(reparto: RepartoSuelos): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const clase of reparto) conteo[clase] = (conteo[clase] ?? 0) + 1;
  const total = reparto.length || 1;
  return Object.fromEntries(Object.entries(conteo).map(([c, n]) => [c, (n / total) * 100]));
}

/** Celdas contiguas de la misma clase: mide cuánto "manchosa" es un reparto. */
export function celdasAisladas(reparto: RepartoSuelos, config: GridConfig): number {
  let aisladas = 0;
  for (let z = 0; z < config.rows; z++) {
    for (let x = 0; x < config.cols; x++) {
      const clase = reparto[z * config.cols + x];
      const iguales = VENTANA.filter(([dx, dz]) => {
        const nx = x + dx;
        const nz = z + dz;
        return (
          nx >= 0 &&
          nz >= 0 &&
          nx < config.cols &&
          nz < config.rows &&
          reparto[nz * config.cols + nx] === clase
        );
      }).length;
      if (iguales === 1) aisladas++;
    }
  }
  return aisladas;
}
