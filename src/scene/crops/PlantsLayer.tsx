/**
 * Paso 01/04 · Cultivos sobre la grilla: cada especie tiene su propio diseño low-poly y la
 * forma cambia con el crecimiento (tamaño, flores, frutos, senescencia). La etapa además
 * se lee en el anillo de color de la base (leyenda "Etapa del cultivo").
 * Sustituible por los .glb de @/scene/assets cuando existan.
 */
import { useMemo } from 'react';
import { container } from '@/app/container';
import type { TileNode } from '@/domain/grid';
import type { GridOffset } from '@/scene/tiles';
import { PlantField, type PlantaEnCelda } from './PlantField';

export interface PlantsLayerProps {
  tiles: readonly TileNode[];
  offset: GridOffset;
}

export function PlantsLayer({ tiles, offset }: PlantsLayerProps) {
  const plantas = useMemo<PlantaEnCelda[]>(
    () =>
      tiles.flatMap((tile) => {
        const crop = container.crops.find(tile.vegetacionId);
        if (!crop) return [];
        return [
          {
            tile,
            cultivo: crop.nombre,
            estado: {
              etapa: crop.etapaEn(tile.diasCultivo),
              progreso: Math.min(1, tile.diasCultivo / crop.cicloDias),
              salud: tile.salud,
              muerta: tile.salud <= 0,
            },
          },
        ];
      }),
    [tiles],
  );

  return <PlantField plantas={plantas} offset={offset} />;
}
