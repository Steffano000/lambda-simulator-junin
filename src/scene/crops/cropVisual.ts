/**
 * State → Visual del cultivo: etapa fenológica → altura y color de la planta.
 * Funciones puras (sin Three.js ni React) para que la capa PlantsLayer solo dibuje.
 */
import type { EtapaVisual } from '@/domain/crops';
import { stageColor } from '@/theme/ramps';
import { surface } from '@/theme/tokens';

/** Altura (m) de la planta por etapa: de la siembra al porte completo de la cosecha. */
export const ALTURA_POR_ETAPA: Record<EtapaVisual, number> = {
  siembra: 0.12,
  germinacion: 0.25,
  desarrollo: 0.45,
  media: 0.7,
  final: 0.8,
  cosecha: 0.8,
};

/** Cultivo muerto: se achata para que la pérdida se lea sin tapar el color de la celda. */
export const ALTURA_CROPO_MUERTO = 0.15;

/** Altura visible de la planta. */
export const cropHeight = (etapa: EtapaVisual, muerta: boolean): number =>
  muerta ? ALTURA_CROPO_MUERTO : ALTURA_POR_ETAPA[etapa];

/** Color de la planta: rampa de etapa; el cultivo muerto cae en gris de roca. */
export const cropColor = (etapa: EtapaVisual, muerta: boolean): string =>
  muerta ? surface.roca : stageColor(etapa);
