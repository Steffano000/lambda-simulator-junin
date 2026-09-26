/**
 * Hooks de lectura para la VISTA: combinan el store con el dominio (vía controlador)
 * y se re-evalúan solo cuando cambian los campos de los que dependen.
 */
import { container } from '@/app/container';
import type { ClimaMes } from '@/data/types';
import { useSimStore } from '@/store/useSimStore';
import { simulationController } from './SimulationController';

export const useController = () => simulationController;

export function useMesActual(): number {
  const mesInicio = useSimStore((s) => s.mesInicio);
  const dia = useSimStore((s) => s.dia);
  return simulationController.mesActual({ mesInicio, dia });
}

export function useClimaActual(): ClimaMes {
  const escenario = useSimStore((s) => s.escenario);
  const mes = useMesActual();
  return container.scenarios.create(escenario).mes(mes);
}

/** Motivos de calendario/clima por cultivo (vacío = se puede sembrar este mes). */
export function useCropBlockers(): Record<string, string[]> {
  // Dependencias explícitas: recalcula al cambiar escenario o calendario
  useSimStore((s) => s.escenario);
  useMesActual();
  return Object.fromEntries(
    container.crops.all().map((c) => [c.nombre, simulationController.cropBlockers(c.nombre)]),
  );
}
