/**
 * Paso 02 · Clase base de las herramientas por celda (Command + Template Method).
 * `run()` fija el flujo: validar → aplicar → propagar. Cada subclase solo define
 * sus precondiciones (`validate`), su efecto (`apply`) y sus metadatos para la UI;
 * las que afectan vecinas sobrescriben `propagate` (Observer de dominio, EP-05.2).
 */
import type { ClimaMes, Terreno } from '@/data/types';
import type { Crop, RequirementId } from '../crops';
import type { OrientacionSurco, TileNode } from '../grid';
import type { PropiedadesHidricas } from '../hydrology';
import type { TerrainProfile } from '../terrain';

export interface ActionContext {
  /** Cultivo seleccionado para sembrar */
  crop?: Crop;
  /** Día simulado actual */
  dia: number;
  /** Mes calendario actual (1–12) */
  mes: number;
  /** Clima del mes en el escenario activo */
  clima: ClimaMes;
  /** Resuelve el cultivo de una celda (para cosechar/regar) */
  cropOf: (nombre: string | null) => Crop | undefined;
  /** Propiedades hidráulicas de la clase de suelo (data/terrenos.json) */
  soilOf: (clase: string) => Terreno | undefined;
  /** Variables hídricas del suelo (absorción, retención, drenaje, saturación) */
  hidraulica: (clase: string) => PropiedadesHidricas | undefined;
  /** Orientación de los surcos al arar */
  direccionArado: OrientacionSurco;
  /** Días de barbecho para la acción "Dejar en descanso" */
  diasDescanso?: number;
}

export interface Cosecha {
  tileId: string;
  cultivo: string;
  dia: number;
  /** Salud (CHI) de la planta al cosechar */
  salud: number;
  /** kg en la celda de 1 m² = rendimiento de referencia Junín 2025 × CHI */
  kg: number;
}

export interface CommandOutcome {
  tiles: TileNode[];
  cosecha?: Cosecha;
}

export type CategoriaAccion = 'tratamiento' | 'plantacion';

export abstract class TileCommand {
  abstract readonly id: string;
  abstract readonly etiqueta: string;
  abstract readonly categoria: CategoriaAccion;
  /** Qué hace, en una línea */
  abstract readonly descripcion: string;
  /** Efectos sobre la celda (y vecinas) */
  abstract readonly efectos: readonly string[];
  /** Condiciones que debe cumplir la celda */
  abstract readonly prerrequisitos: readonly string[];
  /** Requisitos de siembra que esta acción ayuda a cumplir */
  readonly resuelve: readonly RequirementId[] = [];
  /** Condición del terreno para que la acción exista (texto); vacío = cualquier terreno */
  readonly condicionTerreno: string = '';
  /** Texto de éxito mostrado al usuario */
  abstract readonly exito: string;

  /** ¿La acción corresponde a este tipo de terreno? (p. ej. drenar solo suelos pesados) */
  aplicaA(_terreno: TerrainProfile): boolean {
    return true;
  }

  /** `null` si se puede ejecutar, o el motivo del bloqueo. */
  protected abstract validate(tile: TileNode, ctx: ActionContext): string | null;

  protected abstract apply(tile: TileNode, ctx: ActionContext): TileNode;

  /** Efecto sobre vecinas: por defecto ninguno. */
  protected propagate(grid: TileNode[], _target: TileNode, _ctx: ActionContext): TileNode[] {
    return grid;
  }

  /** Solo la etapa de validación, para deshabilitar/explicar en la UI. */
  check(tile: TileNode, ctx: ActionContext): string | null {
    if (tile.bloqueado) return tile.bloqueado.motivo;
    return this.validate(tile, ctx);
  }

  /** Plantilla: validar → aplicar → propagar. Nunca muta: devuelve una grilla nueva. */
  run(grid: readonly TileNode[], tileId: string, ctx: ActionContext): CommandOutcome | string {
    const index = grid.findIndex((t) => t.id === tileId);
    if (index < 0) return `Celda ${tileId} no existe.`;
    const target = grid[index];

    const motivo = target.bloqueado ? target.bloqueado.motivo : this.validate(target, ctx);
    if (motivo) return motivo;

    const updated = this.apply(target, ctx);
    const next = [...grid];
    next[index] = updated;
    return { tiles: this.propagate(next, updated, ctx), cosecha: this.harvest(target, ctx) };
  }

  /** Solo `Cosechar` produce una cosecha. */
  protected harvest(_tile: TileNode, _ctx: ActionContext): Cosecha | undefined {
    return undefined;
  }
}
