/**
 * Validación de prerrequisitos antes de plantar: separa las celdas listas de las que
 * requieren tratamiento, agrupa lo que falta y sugiere qué herramienta lo corrige.
 * Una celda que no cumple nunca bloquea al resto.
 */
import type { Crop, Requirement } from '../crops';
import type { TileNode } from '../grid';
import type { ActionsService } from './ActionsService';
import type { ToolId } from './CommandFactory';
import type { ActionContext } from './TileCommand';

export interface Pendiente {
  requisito: Requirement;
  tileIds: string[];
  /** Tratamientos que corrigen este requisito */
  herramientas: ToolId[];
}

export interface ValidacionSiembra {
  cultivo: string;
  /** Celdas que cumplen todo y pueden sembrarse */
  listas: string[];
  /** Celdas que requieren tratamiento (ids únicos) */
  aCorregir: string[];
  /** Lo que falta, agrupado por requisito */
  pendientes: Pendiente[];
  /** Motivos del calendario o clima: afectan a todas las celdas */
  bloqueosCultivo: string[];
  /** Motivo por celda (primer requisito faltante) */
  motivoPorCelda: Record<string, string>;
}

export class PlantingValidator {
  constructor(private readonly actions: ActionsService) {}

  validar(crop: Crop, tiles: readonly TileNode[], ctx: ActionContext): ValidacionSiembra {
    const listas: string[] = [];
    const aCorregir: string[] = [];
    const motivoPorCelda: Record<string, string> = {};
    const porRequisito = new Map<string, Pendiente>();

    for (const tile of tiles) {
      const faltantes = crop.faltantes(tile);
      if (faltantes.length === 0) {
        listas.push(tile.id);
        continue;
      }
      aCorregir.push(tile.id);
      motivoPorCelda[tile.id] = faltantes.map((f) => f.motivo).join(' ');
      for (const { requisito } of faltantes) {
        let pendiente = porRequisito.get(requisito.id);
        if (!pendiente) {
          pendiente = { requisito, tileIds: [], herramientas: this.actions.resolvedoras(requisito.id) };
          porRequisito.set(requisito.id, pendiente);
        }
        pendiente.tileIds.push(tile.id);
      }
    }

    return {
      cultivo: crop.nombre,
      listas,
      aCorregir,
      pendientes: [...porRequisito.values()],
      bloqueosCultivo: [...crop.motivosCalendario(ctx.mes), ...crop.motivosClima(ctx.clima)],
      motivoPorCelda,
    };
  }
}
