/** Estado del módulo climático: escenarios personalizados, borrador del sandbox y panel abierto. */
import type { StateCreator } from 'zustand';
import { container } from '@/app/container';
import { CustomScenarioStorage, type EscenarioGuardado } from '@/data/customScenarioStorage';
import type { Ediciones, Modificadores } from '@/domain/climate';

export type VistaClima = 'escenarios' | 'sandbox';

/** Escenario en edición dentro del sandbox. */
export interface BorradorClima {
  nombre: string;
  /** Escenario del que se parte */
  base: string;
  modificadores: Modificadores;
  ediciones: Ediciones;
  /** Nombre del personalizado que se está editando (null = nuevo) */
  editando: string | null;
}

export interface ClimateSlice {
  /** Escenarios personalizados (fuente de verdad; la Factory los refleja) */
  personalizados: EscenarioGuardado[];
  /** Panel climático abierto, o null */
  vistaClima: VistaClima | null;
  borrador: BorradorClima | null;
  /** Cultivo usado en la comparativa de escenarios */
  cultivoComparacion: string;
  /** Errores de validación del borrador o de la importación */
  erroresClima: string[];
}

/** Registra en la Factory los escenarios guardados que sigan siendo válidos. */
function restaurar(): EscenarioGuardado[] {
  return CustomScenarioStorage.load().filter((e) => {
    try {
      container.scenarios.custom(e.nombre, e.meses, e.base);
      return true;
    } catch {
      return false;
    }
  });
}

export const createClimateSlice: StateCreator<ClimateSlice, [], [], ClimateSlice> = () => ({
  personalizados: restaurar(),
  vistaClima: null,
  borrador: null,
  cultivoComparacion: container.crops.all()[0]?.nombre ?? '',
  erroresClima: [],
});
