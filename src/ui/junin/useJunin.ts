/** Lecturas derivadas del modo Junín (se recalculan solo cuando cambian sus entradas). */
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SiembraRepository } from '@/data';
import {
  evaluarSiembra,
  kgPorPlanta,
  rendimiento,
  rendimientoPorChunk,
  type EvaluacionSiembra,
  type RendimientoChunks,
  type ResultadoRendimiento,
} from '@/domain/junin';
import { useJuninStore } from '@/store/juninStore';

export interface ResultadoJunin {
  r: ResultadoRendimiento;
  /** null si la siembra no es apta (Fase 3): el motor no da rendimiento */
  rc: RendimientoChunks | null;
  nombre: string;
  /** Condiciones de plantación (Fase 3) */
  ev: EvaluacionSiembra | null;
  /** Rendimiento del punto × helada corregida por altura (t/ha) */
  rend_t_ha: number;
  kg_planta: number | null;
}

export function useResultadoJunin(): ResultadoJunin | null {
  const { nucleo, ubicacion, escenario, cultivo, anterior, campana, chunks, resumen } = useJuninStore(
    useShallow((s) => ({
      nucleo: s.nucleo,
      ubicacion: s.ubicacion,
      escenario: s.escenario,
      cultivo: s.cultivo,
      anterior: s.anterior,
      campana: s.campana,
      chunks: s.chunks,
      resumen: s.resumen,
    })),
  );
  return useMemo(() => {
    if (!nucleo || !ubicacion || !cultivo || ubicacion.fuera_de_junin) return null;
    const r = rendimiento(ubicacion.punto, escenario, cultivo, anterior, nucleo, campana);
    if (!r) return null;
    const ev =
      chunks && resumen
        ? evaluarSiembra({
            cultivo,
            escenario,
            campana,
            anterior,
            punto: ubicacion.punto,
            distancia_km: ubicacion.distancia_km,
            chunks,
            resumen,
            nucleo,
            siembra: SiembraRepository.all(),
          })
        : null;
    const rend_t_ha = Math.round(r.rend_t_ha * (ev?.factor_helada ?? 1) * 100) / 100;
    const eco = nucleo.catalogo.cultivos[cultivo]?.ecocrop;
    const phRef = nucleo.sim.puntos[ubicacion.punto]?.suelo.ph ?? null;
    const rc = chunks && ev?.estado !== 'no_apta' ? rendimientoPorChunk(chunks, rend_t_ha, eco, phRef) : null;
    return {
      r,
      rc,
      ev,
      rend_t_ha,
      kg_planta: ev?.marco && rc ? kgPorPlanta(ev.marco, rc.rend_parcela_t_ha) : null,
      nombre: nucleo.catalogo.cultivos[cultivo]?.nombre ?? cultivo,
    };
  }, [nucleo, ubicacion, escenario, cultivo, anterior, campana, chunks, resumen]);
}
