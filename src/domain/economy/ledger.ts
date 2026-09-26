/**
 * Bitácora de acciones: qué se hizo, cuándo y sobre qué celdas. Es la fuente del resumen
 * de cosecha (lo gastado para obtener el cultivo) y no se reescribe: solo se agregan filas.
 */
import type { ToolId } from '../actions';

export interface RegistroAccion {
  dia: number;
  tool: ToolId;
  /** Celdas donde la acción SÍ se aplicó */
  tileIds: readonly string[];
  /** Cultivo involucrado (siembra, cosecha, remoción) */
  cultivo?: string;
}

/** Acciones que cierran el ciclo de una celda: después empieza uno nuevo. */
const CIERRAN_CICLO: ReadonlySet<ToolId> = new Set<ToolId>(['cosechar', 'remover']);

/**
 * Registros del ciclo que terminó con la cosecha de `celdas` en `diaCosecha`: los que tocan
 * esas celdas desde el cierre del ciclo anterior (cosecha o remoción previa).
 */
export function registrosDelCiclo(
  bitacora: readonly RegistroAccion[],
  celdas: ReadonlySet<string>,
  diaSiembra: number,
): RegistroAccion[] {
  const toca = (r: RegistroAccion) => r.tileIds.some((id) => celdas.has(id));
  let inicio = -Infinity;
  for (const r of bitacora) {
    if (r.dia <= diaSiembra && CIERRAN_CICLO.has(r.tool) && toca(r)) inicio = Math.max(inicio, r.dia);
  }
  // Registros posteriores al cierre anterior (incluido el propio día de cierre si fue antes de sembrar)
  return bitacora.filter(
    (r) => toca(r) && (r.dia > inicio || (r.dia === inicio && !CIERRAN_CICLO.has(r.tool))),
  );
}
