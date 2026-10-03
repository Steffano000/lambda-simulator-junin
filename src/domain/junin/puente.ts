/**
 * Puente Junín → simulador 3D existente: convierte la grilla de chunks de la parcela real
 * en celdas (TileNode) con su suelo, pH, materia orgánica y relieve, y marca como
 * bloqueadas las que están fuera del polígono o en ciudad, agua o nieve.
 */
import type { MezclaSuelos, Terreno } from '@/data/types';
import { AGUA_INICIAL, GRID_LIMITS, tileId, type GridConfig, type TileNode } from '../grid';
import type { ReaccionPh } from '../terrain';
import { usable } from './estadoChunk';
import type { Chunk, GrillaChunks } from './parcela';
import { fidelidadChunk } from './resolucion';

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
  casa: '#8E2C2C',
  area_protegida: '#2E6B3A',
  sin_dato: '#B0B4B9',
};

export interface ParcelaParaSimulador {
  config: GridConfig;
  tiles: TileNode[];
  mezcla: MezclaSuelos;
  dominante: Terreno;
  reaccion: ReaccionPh;
  celdasBloqueadas: number;
  /** Celdas del rectángulo que quedan fuera del polígono: no se dibujan */
  celdasOcultas: number;
  recorte: boolean;
}

export function reaccionPorPh(ph: number | null): ReaccionPh {
  if (ph == null) return 'neutro';
  if (ph < 5.8) return 'acido';
  if (ph > 7.3) return 'alcalino';
  return 'neutro';
}

export function parcelaParaSimulador(g: GrillaChunks, terrenos: readonly Terreno[]): ParcelaParaSimulador {
  const filas = Math.min(g.filas, GRID_LIMITS.max);
  const columnas = Math.min(g.columnas, GRID_LIMITS.max);
  const usados = g.chunks.filter((c) => c.fila < filas && c.columna < columnas);
  // Solo los chunks con datos definen el suelo, el pH y la altura base (nada se rellena por defecto)
  const validos = usados.filter(usable);

  const conteo: Record<string, number> = {};
  for (const c of validos) if (c.textura) conteo[c.textura] = (conteo[c.textura] ?? 0) + c.fraccion;
  const ordenadas = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const dominante = terrenos.find((t) => t.clase === ordenadas[0]?.[0]) ?? terrenos[0];
  const total = validos.reduce((a, c) => a + c.fraccion, 0) || 1;
  const porcentajes = Object.fromEntries(
    terrenos.map((t) => [t.clase, Math.round((100 * (conteo[t.clase] ?? 0)) / total)]),
  );

  const elevs = usados.filter((c) => c.dentro && c.elevacion_m != null).map((c) => c.elevacion_m!);
  const eMin = elevs.length ? Math.min(...elevs) : 0;
  const phs = validos.map((c) => c.ph!);
  const phMedio = phs.length ? phs.reduce((a, b) => a + b, 0) / phs.length : null;

  const tiles: TileNode[] = usados.map((c) => {
    const elev = c.elevacion_m == null ? 0 : ((c.elevacion_m - eMin) / g.celda_m) * EXAGERACION_RELIEVE;
    const util = usable(c);
    const bloqueo = util
      ? null
      : {
          motivo: c.motivo ?? (c.dentro ? 'Sin dato.' : 'Fuera de la parcela dibujada.'),
          color: colorBloqueo(c),
        };
    // En celdas bloqueadas o sin dato el suelo es solo de relleno visual: ninguna acción las usa
    const mo = util ? Math.min(8, Math.max(0.5, c.cos_pct! * 1.724)) : 0;
    return {
      id: tileId(c.columna, c.fila),
      coords: { x: c.columna, z: c.fila },
      elevacion: Math.max(0, Math.round(elev * 10) / 10),
      suelo: {
        clase: util && c.textura && terrenos.some((t) => t.clase === c.textura) ? c.textura : dominante.clase,
        ph: +(util ? c.ph! : (phMedio ?? 7)).toFixed(1),
        // supuestos del simulador (no son datos medidos): N a partir de la MO, P y K iniciales
        n: util ? Math.round(Math.min(70, Math.max(15, 15 + mo * 10))) : 0,
        p: SUPUESTOS_SIMULADOR.p,
        k: SUPUESTOS_SIMULADOR.k,
        materiaOrganica: +mo.toFixed(1),
      },
      humedad: SUPUESTOS_SIMULADOR.humedad,
      vegetacionId: null,
      estado: 'baldio',
      diasCultivo: 0,
      canal: false,
      salud: 100,
      ...AGUA_INICIAL,
      bloqueado: bloqueo,
      oculto: !c.dentro,
      fidelidad: fidelidadChunk(c, g.celda_m),
    };
  });

  return {
    config: { rows: filas, cols: columnas, seed: 2026, cellSize: 1 },
    tiles,
    mezcla: {
      id: 'junin-parcela',
      nombre: 'Parcela real (Junín)',
      descripcion: 'Texturas de SoilGrids en los chunks con datos de la parcela dibujada',
      porcentajes,
    },
    dominante,
    reaccion: reaccionPorPh(phMedio),
    celdasBloqueadas: tiles.filter((t) => t.bloqueado && !t.oculto).length,
    celdasOcultas: tiles.filter((t) => t.oculto).length,
    recorte: filas < g.filas || columnas < g.columnas,
  };
}

/** Valores iniciales del simulador que NO vienen de datos medidos (se avisan al cargar la parcela) */
export const SUPUESTOS_SIMULADOR = { p: 25, k: 150, humedad: 50 } as const;

function colorBloqueo(c: Chunk): string {
  if (c.estado === 'sin_dato') return COLOR_BLOQUEO.sin_dato;
  if (c.bloqueo === 'casa') return COLOR_BLOQUEO.casa;
  if (c.bloqueo === 'area_protegida') return COLOR_BLOQUEO.area_protegida;
  return COLOR_BLOQUEO[String(c.worldcover)] ?? COLOR_BLOQUEO['50'];
}
