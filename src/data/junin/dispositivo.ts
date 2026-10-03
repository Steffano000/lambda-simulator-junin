/**
 * Límites de rendimiento según el equipo (Fase 2). En celulares y equipos modestos la grilla 3D
 * de 100 × 100 (10 000 bloques) y la imagen de chunks se vuelven lentas: se limita a 50 × 50.
 * Se considera modesto: pantalla táctil como puntero principal, ≤ 2 núcleos o ≤ 2 GB de memoria.
 */
import { MAX_LADO } from '@/domain/junin/parcela';

/** Chunks por lado en celulares / tablets o equipos con ≤ 2 núcleos o ≤ 2 GB */
export const MAX_LADO_MOVIL = 50;

export interface LimiteDispositivo {
  maxLado: number;
  movil: boolean;
  motivo: string | null;
}

export function limiteDispositivo(): LimiteDispositivo {
  if (typeof window === 'undefined') return { maxLado: MAX_LADO, movil: false, motivo: null };
  const tactil = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const nucleos = navigator.hardwareConcurrency ?? 8;
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const movil = tactil || nucleos <= 2 || memoria <= 2;
  if (!movil) return { maxLado: MAX_LADO, movil, motivo: null };
  const por = tactil ? 'pantalla táctil' : nucleos <= 2 ? `${nucleos} núcleos` : `${memoria} GB de memoria`;
  return {
    maxLado: MAX_LADO_MOVIL,
    movil,
    motivo: `Equipo modesto (${por}): máximo ${MAX_LADO_MOVIL} × ${MAX_LADO_MOVIL} chunks para que el mapa y el 3D vayan fluidos.`,
  };
}
