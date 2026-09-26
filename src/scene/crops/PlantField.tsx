/**
 * Campo de plantas instanciado: cada planta es un modelo de varias piezas (cropModels) y
 * todas las piezas de una misma forma comparten UNA malla instanciada (design.md §2).
 * Lo usan el cultivo real y la vista previa translúcida de la fase de cultivos.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { TileNode } from '@/domain/grid';
import { InstanceField, getMaterial, type MaterialCategory } from '@/scene/render';
import { tileCenter, tileSurfaceY, type GridOffset } from '@/scene/tiles';
import { FORMAS, GEOMETRIA, matrizPieza, yawDe } from './cropGeometry';
import { modeloPlanta, type EstadoPlanta, type Forma } from './cropModels';

export interface PlantaEnCelda {
  tile: TileNode;
  cultivo: string;
  estado: EstadoPlanta;
}

interface PiezaMundo {
  matrix: THREE.Matrix4;
  color: string;
}

/** Capacidad en potencias de 2: sembrar o cosechar no remonta la malla en cada cambio. */
const capacidad = (n: number) => Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(n, 1))));

export interface PlantFieldProps {
  plantas: readonly PlantaEnCelda[];
  offset: GridOffset;
  material?: MaterialCategory;
}

export function PlantField({ plantas, offset, material = 'planta' }: PlantFieldProps) {
  const porForma = useMemo(() => {
    const grupos: Record<Forma, PiezaMundo[]> = { caja: [], cono: [], cilindro: [], esfera: [] };
    for (const { tile, cultivo, estado } of plantas) {
      const { x, z } = tileCenter(tile, offset);
      const y = tileSurfaceY(tile);
      const yaw = yawDe(tile.id);
      for (const pieza of modeloPlanta(cultivo, estado)) {
        grupos[pieza.forma].push({ matrix: matrizPieza(pieza, x, y, z, yaw), color: pieza.color });
      }
    }
    return grupos;
  }, [plantas, offset]);

  return (
    <>
      {FORMAS.map((forma) => (
        <InstanceField
          key={forma}
          geometry={GEOMETRIA[forma]}
          material={getMaterial(material)}
          items={porForma[forma]}
          capacity={capacidad(porForma[forma].length)}
          place={(batch, pieza, i) => batch.placeMatrix(i, pieza.matrix)}
          paint={(pieza) => pieza.color}
        />
      ))}
    </>
  );
}
