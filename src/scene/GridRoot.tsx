/**
 * Grilla de cubos 1 m³ con instancing (design.md §2).
 * VISTA: solo lee el store. La selección se delega al controlador:
 * pulsar = punto de inicio, arrastrar = área cuadrada, soltar = fin.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useControllers, useResaltadas } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { getMaterial } from './factories/materialFactory';
import { PlantsLayer } from './PlantsLayer';
import { SelectionLayer } from './SelectionLayer';
import { tileColor, tileHeight } from './tileVisual';

const box = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const color = new THREE.Color();

export function GridRoot() {
  const { selection } = useControllers();
  const tiles = useSimStore((s) => s.tiles);
  const config = useSimStore((s) => s.config);
  const overlay = useSimStore((s) => s.overlay);
  const seleccion = useSimStore((s) => s.seleccion);
  const resaltadas = useResaltadas();
  const ref = useRef<THREE.InstancedMesh>(null);

  // Centro de la grilla en el origen
  const offset = useMemo(() => ({ x: (config.cols - 1) / 2, z: (config.rows - 1) / 2 }), [config]);
  const seleccionSet = useMemo(() => new Set(seleccion), [seleccion]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    tiles.forEach((tile, i) => {
      const h = tileHeight(tile);
      // Gap mínimo entre bloques para leer la grilla a 1600 celdas
      dummy.position.set(tile.coords.x - offset.x, tile.elevacion + h / 2, tile.coords.z - offset.z);
      dummy.scale.set(0.96, h, 0.96);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(tileColor(tile, overlay)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tiles, overlay, offset]);

  // El arrastre puede terminar fuera del canvas
  useEffect(() => {
    const end = () => selection.end();
    window.addEventListener('pointerup', end);
    return () => window.removeEventListener('pointerup', end);
  }, [selection]);

  const idDe = (e: ThreeEvent<PointerEvent>) =>
    e.instanceId !== undefined ? tiles[e.instanceId]?.id : undefined;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return; // derecho/central: cámara
    e.stopPropagation();
    const id = idDe(e);
    if (id) selection.begin(id);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!selection.arrastrando) return;
    const id = idDe(e);
    if (id) selection.extend(id);
  };

  return (
    <group>
      <instancedMesh
        key={tiles.length}
        ref={ref}
        args={[box, getMaterial('terreno'), tiles.length]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerMissed={(e) => e.button === 0 && selection.clear()}
      />
      <PlantsLayer tiles={tiles} offset={offset} />
      <SelectionLayer tiles={tiles} offset={offset} ids={resaltadas} tipo="resaltada" />
      <SelectionLayer tiles={tiles} offset={offset} ids={seleccionSet} tipo="seleccion" />
    </group>
  );
}
