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
import { SiembraRepository } from '@/data';
import { FORMAS, GEOMETRIA, matrizPieza, yawDe } from './cropGeometry';
import { modeloPlanta, type EstadoPlanta, type Forma } from './cropModels';
import { disposicionPlantas, MAX_PLANTAS_ESCENA } from './plantLayout';

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
    // Fase 3: varias plantas por celda según el marco de plantación (INIA) y el tamaño de la celda
    const disp = (p: PlantaEnCelda, muestra: number) =>
      disposicionPlantas(
        SiembraRepository.byNombre3D(p.cultivo),
        p.tile.ladoM ?? 1,
        p.tile.areaM2 ?? 1,
        muestra,
      );
    const total = plantas.reduce((a, p) => a + disp(p, 1).pos.length, 0);
    const muestra = Math.min(1, MAX_PLANTAS_ESCENA / Math.max(1, total));
    for (const p of plantas) {
      const { tile, cultivo, estado } = p;
      const { x, z } = tileCenter(tile, offset);
      const y = tileSurfaceY(tile);
      const d = disp(p, muestra);
      const piezas = modeloPlanta(cultivo, estado);
      d.pos.forEach(([dx, dz], k) => {
        const yaw = yawDe(`${tile.id}#${k}`);
        for (const pieza of piezas)
          grupos[pieza.forma].push({
            matrix: matrizPieza(pieza, x + dx, y, z + dz, yaw, undefined, d.escala),
            color: pieza.color,
          });
      });
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
