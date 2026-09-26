/**
 * Fase de cultivos · vista previa en el terreno: el cultivo elegido, ya en su etapa final,
 * dibujado translúcido sobre las celdas listas para sembrar. Muestra cómo se verá la
 * plantación antes de confirmarla. Se apaga fuera de la fase de cultivos.
 */
import { useMemo } from 'react';
import { useValidacion } from '@/controllers/hooks';
import type { TileNode } from '@/domain/grid';
import { useSimStore } from '@/store/useSimStore';
import type { GridOffset } from '@/scene/tiles';
import { PlantField, type PlantaEnCelda } from './PlantField';
import { ESTADO_PREVIA } from './cropModels';

export function PreviewPlantsLayer({ tiles, offset }: { tiles: readonly TileNode[]; offset: GridOffset }) {
  const fase = useSimStore((s) => s.fase);
  const cultivo = useSimStore((s) => s.cultivo);
  const activa = useSimStore((s) => s.previaCultivo);
  const validacion = useValidacion();

  const plantas = useMemo<PlantaEnCelda[]>(() => {
    if (fase !== 'cultivos' || !cultivo || !activa || !validacion) return [];
    const listas = new Set(validacion.listas);
    return tiles.filter((t) => listas.has(t.id)).map((tile) => ({ tile, cultivo, estado: ESTADO_PREVIA }));
  }, [fase, cultivo, activa, validacion, tiles]);

  return <PlantField plantas={plantas} offset={offset} material="planta-fantasma" />;
}
