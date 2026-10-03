/** Lecturas derivadas del modo Junín (se recalculan solo cuando cambian sus entradas). */
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  rendimiento,
  rendimientoPorChunk,
  type RendimientoChunks,
  type ResultadoRendimiento,
} from '@/domain/junin';
import { useJuninStore } from '@/store/juninStore';

export interface ResultadoJunin {
  r: ResultadoRendimiento;
  rc: RendimientoChunks | null;
  nombre: string;
}

export function useResultadoJunin(): ResultadoJunin | null {
  const { nucleo, ubicacion, escenario, cultivo, anterior, campana, chunks, area_ha } = useJuninStore(
    useShallow((s) => ({
      nucleo: s.nucleo,
      ubicacion: s.ubicacion,
      escenario: s.escenario,
      cultivo: s.cultivo,
      anterior: s.anterior,
      campana: s.campana,
      chunks: s.chunks,
      area_ha: s.area_ha,
    })),
  );
  return useMemo(() => {
    if (!nucleo || !ubicacion || !cultivo || ubicacion.fuera_de_junin) return null;
    const r = rendimiento(ubicacion.punto, escenario, cultivo, anterior, nucleo, campana);
    if (!r) return null;
    const eco = nucleo.catalogo.cultivos[cultivo]?.ecocrop;
    const phRef = nucleo.sim.puntos[ubicacion.punto]?.suelo.ph ?? null;
    const rc = chunks ? rendimientoPorChunk(chunks, r.rend_t_ha, eco, area_ha, phRef) : null;
    return { r, rc, nombre: nucleo.catalogo.cultivos[cultivo]?.nombre ?? cultivo };
  }, [nucleo, ubicacion, escenario, cultivo, anterior, campana, chunks, area_ha]);
}
