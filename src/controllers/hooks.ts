/**
 * Hooks de lectura para la VISTA: combinan el store con el dominio (vía controladores)
 * y se recalculan solo cuando cambian los campos de los que dependen.
 */
import { useMemo } from 'react';
import { container } from '@/app/container';
import type { ToolId, ToolInfo, ValidacionSiembra } from '@/domain/actions';
import { EnvironmentModel, type ClimaDia, type ClimateScenario, type Modificador } from '@/domain/climate';
import type { ClimaMes } from '@/data/types';
import { useSimStore } from '@/store/useSimStore';
import { controllers } from './index';

export const useControllers = () => controllers;

export function useMesActual(): number {
  const mesInicio = useSimStore((s) => s.mesInicio);
  const dia = useSimStore((s) => s.dia);
  return EnvironmentModel.mesActual(mesInicio, dia);
}

export function useClima(): {
  mes: number;
  mensual: ClimaMes;
  diario: ClimaDia;
  modificadores: Modificador[];
} {
  const escenario = useSimStore((s) => s.escenario);
  const personalizados = useSimStore((s) => s.personalizados);
  const mes = useMesActual();
  return useMemo(() => {
    const e = container.scenarios.create(escenario);
    const mensual = e.mes(mes);
    return {
      mes,
      mensual,
      diario: EnvironmentModel.diario(mensual),
      modificadores: EnvironmentModel.modificadores(e, mes),
    };
    // `personalizados`: un escenario editado conserva su nombre pero cambia sus datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escenario, mes, personalizados]);
}

/** Escenarios reales + personalizados; se recalcula al crear, editar o borrar uno. */
export function useEscenarios(): ClimateScenario[] {
  const personalizados = useSimStore((s) => s.personalizados);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => container.scenarios.all(), [personalizados]);
}

/**
 * Campos del estado de los que dependen los cálculos derivados. Los controladores leen el
 * estado vigente; estos valores solo indican a useMemo cuándo recalcular.
 */
function useDeps() {
  const tiles = useSimStore((s) => s.tiles);
  const seleccion = useSimStore((s) => s.seleccion);
  const terreno = useSimStore((s) => s.terreno);
  const escenario = useSimStore((s) => s.escenario);
  const mes = useMesActual();
  return { tiles, seleccion, terreno, escenario, mes };
}

export function useDisponibles(): ToolInfo[] {
  const { tiles, seleccion, terreno, escenario, mes } = useDeps();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => controllers.treatment.disponibles(), [tiles, seleccion, terreno, escenario, mes]);
}

/**
 * Para cada tratamiento: cultivos aptos que tienen celdas libres pendientes de un
 * requisito que ese tratamiento resuelve ("necesaria antes de plantar").
 */
export function useNecesidades(): ReadonlyMap<ToolId, string[]> {
  const { tiles, terreno, escenario, mes } = useDeps();
  return useMemo(() => {
    const libres = tiles.filter((t) => !t.canal && !t.vegetacionId);
    const out = new Map<ToolId, string[]>();
    for (const crop of controllers.planting.aptos()) {
      const v = controllers.planting.validar(crop.nombre, libres);
      for (const p of v.pendientes) {
        for (const tool of p.herramientas) {
          const lista = out.get(tool) ?? [];
          if (!lista.includes(crop.nombre)) out.set(tool, [...lista, crop.nombre]);
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, terreno, escenario, mes]);
}

/** Validación del cultivo activo sobre las celdas candidatas. */
export function useValidacion(): ValidacionSiembra | null {
  const cultivo = useSimStore((s) => s.cultivo);
  const { tiles, seleccion, terreno, escenario, mes } = useDeps();
  return useMemo(
    () => (cultivo ? controllers.planting.validar(cultivo) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cultivo, tiles, seleccion, terreno, escenario, mes],
  );
}

/** Celdas a resaltar por no cumplir requisitos (cultivos o corrección en curso). */
export function useResaltadas(): ReadonlySet<string> {
  const fase = useSimStore((s) => s.fase);
  const correccion = useSimStore((s) => s.correccion);
  const cultivo = useSimStore((s) => s.cultivo);
  const { tiles, seleccion, terreno, escenario, mes } = useDeps();
  return useMemo(() => {
    if (correccion) {
      const ids = new Set(correccion.tileIds);
      const v = controllers.planting.validar(
        correccion.cultivo,
        tiles.filter((t) => ids.has(t.id)),
      );
      return new Set(v.aCorregir);
    }
    if (fase === 'cultivos' && cultivo) return new Set(controllers.planting.validar(cultivo).aCorregir);
    return new Set<string>();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, correccion, cultivo, tiles, seleccion, terreno, escenario, mes]);
}
