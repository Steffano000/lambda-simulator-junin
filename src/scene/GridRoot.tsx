/**
 * Paso 01 · Grilla de cubos 1 m³ con instancing (design.md §2).
 * VISTA: solo lee el store; los clics se delegan al controlador.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useController } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { getMaterial } from './factories/materialFactory';
import { PlantsLayer } from './PlantsLayer';
import { tileColor, tileHeight } from './tileVisual';

const box = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const color = new THREE.Color();

export function GridRoot() {
  const controller = useController();
  const tiles = useSimStore((s) => s.tiles);
  const config = useSimStore((s) => s.config);
  const overlay = useSimStore((s) => s.overlay);
  const selectedId = useSimStore((s) => s.selectedId);
  const ref = useRef<THREE.InstancedMesh>(null);

  // Centro de la grilla en el origen
  const offset = useMemo(() => ({ x: (config.cols - 1) / 2, z: (config.rows - 1) / 2 }), [config]);

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

  const selected = tiles.find((t) => t.id === selectedId);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) controller.clickTile(tiles[e.instanceId].id);
  };

  return (
    <group>
      <instancedMesh
        key={tiles.length}
        ref={ref}
        args={[box, getMaterial('terreno'), tiles.length]}
        onClick={onClick}
        onPointerMissed={() => controller.select(null)}
      />
      <PlantsLayer tiles={tiles} offset={offset} />
      {selected && (
        <mesh
          geometry={box}
          material={getMaterial('seleccion')}
          position={[selected.coords.x - offset.x, selected.elevacion + 0.5, selected.coords.z - offset.z]}
          scale={1.02}
        />
      )}
    </group>
  );
}
