/**
 * Hooks de lectura para la VISTA: combinan el store con el dominio (vía controladores)
 * y se recalculan solo cuando cambian los campos de los que dependen.
 */
import { useMemo } from 'react';
import { container } from '@/app/container';
import type { ToolId, ToolInfo, ValidacionSiembra } from '@/domain/actions';
import {
  ETIQUETA_CIELO,
  EnvironmentModel,
  WeatherGenerator,
  cieloDe,
  type ClimaDelDia,
  type ClimaDia,
  type ClimateScenario,
  type EstadoCieloVisual,
  type Modificador,
} from '@/domain/climate';
import type { ClimaMes } from '@/data/types';
import {
  ESTADOS_HIDRICOS,
  efectoEnCultivo,
  estadoHidrico,
  tieneSurcos,
  type EfectoHidrico,
  type EstadoHidrico,
} from '@/domain/hydrology';
import { areaCelda, type TileNode } from '@/domain/grid';
import type { DetalleCultivo } from '@/domain/plantation';
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

/**
 * Clima de HOY (día simulado actual): validación de lluvia, nubes, intensidad y duración.
 * Determinista por semilla del terreno y día; la lluvia de hoy entra al terreno al avanzar.
 */
export function useClimaHoy(): ClimaDelDia {
  const escenario = useSimStore((s) => s.escenario);
  const personalizados = useSimStore((s) => s.personalizados);
  const mesInicio = useSimStore((s) => s.mesInicio);
  const dia = useSimStore((s) => s.dia);
  const seed = useSimStore((s) => s.terreno?.config.seed ?? s.config.seed);
  return useMemo(
    () => WeatherGenerator.generar(container.scenarios.create(escenario), mesInicio, dia, seed),
    // `personalizados`: un escenario editado conserva su nombre pero cambia sus datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [escenario, mesInicio, dia, seed, personalizados],
  );
}

/**
 * Estado visual del cielo de HOY: el que pinta el fondo de la escena y su etiqueta en el
 * panel de ambiente. Deriva de `useClimaHoy`, así que no puede desincronizarse del clima.
 */
export function useCieloVisual(): { estado: EstadoCieloVisual; etiqueta: string } {
  const clima = useClimaHoy();
  return useMemo(() => {
    const estado = cieloDe(clima);
    return { estado, etiqueta: ETIQUETA_CIELO[estado] };
  }, [clima]);
}

export interface ResumenHidrico {
  /** Celdas de suelo por estado de hidratación */
  estados: Record<EstadoHidrico, number>;
  total: number;
  /** Agua libre total en surcos y charcos (L, 1 mm = 1 L/m² × área de cada celda) */
  aguaSuperficieL: number;
  celdasConSurcos: number;
  /** Celdas con cultivo vivo según el efecto del agua */
  plantas: Record<EfectoHidrico, number>;
  saturacionPct: number | null;
}

/** Estado hídrico actual del terreno y su efecto sobre los cultivos. */
export function useResumenHidrico(): ResumenHidrico {
  const tiles = useSimStore((s) => s.tiles);
  return useMemo(() => {
    const estados = Object.fromEntries(ESTADOS_HIDRICOS.map((e) => [e, 0])) as Record<EstadoHidrico, number>;
    const plantas: Record<EfectoHidrico, number> = { deficit: 0, adecuado: 0, exceso: 0, encharcado: 0 };
    let total = 0;
    let aguaSuperficieL = 0;
    let celdasConSurcos = 0;
    let saturacionPct: number | null = null;
    for (const t of tiles) {
      const props = t.canal || t.bloqueado ? undefined : container.hidraulica(t.suelo.clase);
      if (!props) continue;
      saturacionPct = props.saturacionPct;
      const estado = estadoHidrico(t.humedad, t.aguaSuperficie, props.saturacionPct);
      estados[estado]++;
      total++;
      aguaSuperficieL += t.aguaSuperficie * areaCelda(t);
      if (tieneSurcos(t)) celdasConSurcos++;
      const crop = t.salud > 0 ? container.crops.find(t.vegetacionId) : undefined;
      if (crop) plantas[efectoEnCultivo(estado, t.humedad, crop.umbralHumedad)]++;
    }
    return { estados, total, aguaSuperficieL, celdasConSurcos, plantas, saturacionPct };
  }, [tiles]);
}

/** Detalle del cultivo de una celda con el clima de hoy (null si no hay cultivo). */
export function useDetalleCultivo(tile: TileNode | null): DetalleCultivo | null {
  const hoy = useClimaHoy();
  const dia = useSimStore((s) => s.dia);
  const plantaciones = useSimStore((s) => s.plantaciones);
  return useMemo(
    () =>
      tile
        ? controllers.planting.detalleCultivo(tile, {
            tmed: hoy.tmed,
            tmin: hoy.tmin,
            et0: hoy.et0,
            lluviaMm: hoy.lluvia?.mm ?? 0,
          })
        : null,
    // `dia` y `plantaciones`: el controlador los lee del estado vigente
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tile, hoy, dia, plantaciones],
  );
}
