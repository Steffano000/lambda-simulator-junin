/**
 * Fase 5 · Terreno continuo: una sola malla lisa que sigue el relieve y se recorta con el
 * polígono de la parcela (el borde es el que dibujaste, no una escalera de chunks).
 * Cada celda conserva su color (capa activa: suelo, humedad, pH, fidelidad, bloqueos…).
 * Es la capa con puntero en este modo: el punto tocado dice la celda.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { TileNode } from '@/domain/grid';
import { tileColor, type GridOffset } from '@/scene/tiles';
import type { Overlay } from '@/store/useSimStore';
import { useVistaStore } from '@/store/vistaStore';
import type { TilePicking } from '../grid/useTilePicking';
import { alturaEn, gradienteEn, recortarCuadrado, type Heightfield, type Punto2 } from './heightfield';

export interface TerrainSurfaceProps extends TilePicking {
  tiles: readonly TileNode[];
  hf: Heightfield;
  offset: GridOffset;
  overlay: Overlay;
  /** Polígono de la parcela en coordenadas de grilla (null = sin recorte) */
  poligono: readonly Punto2[] | null;
}

const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

export function TerrainSurface({ tiles, hf, offset, overlay, poligono, ...pointer }: TerrainSurfaceProps) {
  const sombra = useVistaStore((s) => s.sombraNubes);
  const geometria = useMemo(() => {
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const color = new THREE.Color();
    const n = new THREE.Vector3();
    const vertice = (gx: number, gz: number) => {
      const [dx, dz] = gradienteEn(hf, gx, gz);
      pos.push(gx - 0.5 - offset.x, alturaEn(hf, gx, gz), gz - 0.5 - offset.z);
      n.set(-dx, 1, -dz).normalize();
      nor.push(n.x, n.y, n.z);
      col.push(color.r, color.g, color.b);
    };
    for (const t of tiles) {
      const c = t.coords.x;
      const r = t.coords.z;
      color.set(tileColor(t, overlay));
      const lado = t.ladoM ?? 1;
      const parcial = poligono && (t.areaM2 ?? lado * lado) < lado * lado * 0.999;
      if (!parcial) {
        // celda completa: dos triángulos (subdividida en 2×2 para que el relieve se vea liso)
        for (const [a, b] of [
          [0, 0],
          [0.5, 0],
          [0, 0.5],
          [0.5, 0.5],
        ]) {
          const x0 = c + a;
          const z0 = r + b;
          vertice(x0, z0);
          vertice(x0, z0 + 0.5);
          vertice(x0 + 0.5, z0);
          vertice(x0 + 0.5, z0);
          vertice(x0, z0 + 0.5);
          vertice(x0 + 0.5, z0 + 0.5);
        }
        continue;
      }
      // celda del borde: solo la parte dentro del polígono
      const parte = recortarCuadrado(poligono!, c, r, c + 1, r + 1);
      if (parte.length < 3) continue;
      const contorno = parte.map(([x, z]) => new THREE.Vector2(x, z));
      for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contorno, []))
        for (const q of [i, k, j]) vertice(parte[q][0], parte[q][1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }, [tiles, hf, offset, overlay, poligono]);

  useEffect(() => () => geometria.dispose(), [geometria]);

  return <mesh geometry={geometria} material={material} receiveShadow={sombra} {...pointer} />;
}
