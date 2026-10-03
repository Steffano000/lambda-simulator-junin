/**
 * Puente Junín → simulador 3D existente: convierte la grilla de chunks de la parcela real
 * en celdas (TileNode) con su suelo, pH, materia orgánica y relieve, y marca como
 * bloqueadas las que están fuera del polígono o en ciudad, agua o nieve.
 */
import type { MezclaSuelos, Terreno } from '@/data/types';
import { AGUA_INICIAL, GRID_LIMITS, tileId, type GridConfig, type TileNode } from '../grid';
import type { ReaccionPh } from '../terrain';
import type { GrillaChunks } from './parcela';

/** Cultivos de Junín que también existen en data/cultivos.json (simulador 3D) */
export const CULTIVO_SIMULADOR: Record<string, string> = {
  papa: 'Papa',
  maiz_amilaceo: 'Maíz amiláceo',
  quinua: 'Quinua',
  haba: 'Haba (grano seco)',
  avena_forrajera: 'Avena forrajera',
};

/** Exageración vertical del relieve en la vista 3D (un bloque = un chunk de lado) */
export const EXAGERACION_RELIEVE = 3;

const COLOR_BLOQUEO: Record<string, string> = {
  '50': '#8A8F96', // urbano
  '70': '#F1F4F7', // nieve
  '80': '#2F6690', // agua
  fuera: '#C9CDD2',
};

export interface ParcelaParaSimulador {
  config: GridConfig;
  tiles: TileNode[];
  mezcla: MezclaSuelos;
  dominante: Terreno;
  reaccion: ReaccionPh;
  celdasBloqueadas: number;
  recorte: boolean;
}

export function reaccionPorPh(ph: number | null): ReaccionPh {
  if (ph == null) return 'neutro';
  if (ph < 5.8) return 'acido';
  if (ph > 7.3) return 'alcalino';
  return 'neutro';
}

export function parcelaParaSimulador(
  g: GrillaChunks,
  terrenos: readonly Terreno[],
  mensajesBloqueo: Record<string, string>,
): ParcelaParaSimulador {
  const filas = Math.min(g.filas, GRID_LIMITS.max);
  const columnas = Math.min(g.columnas, GRID_LIMITS.max);
  const usados = g.chunks.filter((c) => c.fila < filas && c.columna < columnas);
  const validos = usados.filter((c) => c.dentro && c.regla !== 'bloqueado');

  const conteo: Record<string, number> = {};
  for (const c of validos) if (c.textura) conteo[c.textura] = (conteo[c.textura] ?? 0) + 1;
  const ordenadas = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const clasePorDefecto = ordenadas[0]?.[0] ?? 'Franco';
  const dominante = terrenos.find((t) => t.clase === clasePorDefecto) ?? terrenos[0];
  const total = validos.length || 1;
  const porcentajes = Object.fromEntries(
    terrenos.map((t) => [t.clase, Math.round((100 * (conteo[t.clase] ?? 0)) / total)]),
  );
  if (!ordenadas.length) porcentajes[dominante.clase] = 100;

  const elevs = validos.map((c) => c.elevacion_m).filter((x): x is number => x != null);
  const eMin = elevs.length ? Math.min(...elevs) : 0;
  const phs = validos.map((c) => c.ph).filter((x): x is number => x != null);
  const phMedio = phs.length ? phs.reduce((a, b) => a + b, 0) / phs.length : null;

  const tiles: TileNode[] = usados.map((c) => {
    const bloqueo = !c.dentro
      ? { motivo: 'Fuera de la parcela dibujada.', color: COLOR_BLOQUEO.fuera }
      : c.regla === 'bloqueado'
        ? {
            motivo: mensajesBloqueo[String(c.worldcover)] || 'Cobertura donde no se puede sembrar.',
            color: COLOR_BLOQUEO[String(c.worldcover)] ?? COLOR_BLOQUEO['50'],
          }
        : null;
    const elev = c.elevacion_m == null ? 0 : ((c.elevacion_m - eMin) / g.celda_m) * EXAGERACION_RELIEVE;
    const clase = c.textura && terrenos.some((t) => t.clase === c.textura) ? c.textura : dominante.clase;
    const mo = c.cos_pct == null ? 2 : Math.min(8, Math.max(0.5, c.cos_pct * 1.724));
    return {
      id: tileId(c.columna, c.fila),
      coords: { x: c.columna, z: c.fila },
      elevacion: bloqueo && !c.dentro ? 0 : Math.max(0, Math.round(elev * 10) / 10),
      suelo: {
        clase,
        ph: +(c.ph ?? phMedio ?? 6.5).toFixed(1),
        // supuesto del simulador: N disponible en la escala de la app (20-60) a partir de la MO
        n: Math.round(Math.min(70, Math.max(15, 15 + mo * 10))),
        p: 25,
        k: 150,
        materiaOrganica: +mo.toFixed(1),
      },
      humedad: 50,
      vegetacionId: null,
      estado: 'baldio',
      diasCultivo: 0,
      canal: false,
      salud: 100,
      ...AGUA_INICIAL,
      bloqueado: bloqueo,
    };
  });

  return {
    config: { rows: filas, cols: columnas, seed: 2026, cellSize: 1 },
    tiles,
    mezcla: {
      id: 'junin-parcela',
      nombre: 'Parcela real (Junín)',
      descripcion: 'Texturas de SoilGrids en los chunks de la parcela dibujada',
      porcentajes,
    },
    dominante,
    reaccion: reaccionPorPh(phMedio),
    celdasBloqueadas: tiles.filter((t) => t.bloqueado).length,
    recorte: filas < g.filas || columnas < g.columnas,
  };
}
