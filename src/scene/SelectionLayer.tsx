/**
 * Marcas sobre la cara superior: celdas seleccionadas (blanco) y celdas que no cumplen
 * los requisitos del cultivo (rojo). Placas finas instanciadas, sin raycast.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { TileNode } from '@/domain/grid';
import { chi } from '@/theme/tokens';
import { tileHeight } from './tileVisual';

// Marco cuadrado: anillo de 4 lados, visible sin tapar el color de la celda
const marco = new THREE.RingGeometry(0.36, 0.48, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
const dummy = new THREE.Object3D();

const matSeleccion = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.95 });
const matResaltada = new THREE.MeshBasicMaterial({ color: chi[25] });

interface Props {
  tiles: TileNode[];
  offset: { x: number; z: number };
  ids: ReadonlySet<string>;
  tipo: 'seleccion' | 'resaltada';
}

export function SelectionLayer({ tiles, offset, ids, tipo }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const marcadas = useMemo(() => tiles.filter((t) => ids.has(t.id)), [tiles, ids]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // La marca de "resaltada" es un poco menor para convivir con la de selección
    const escala = tipo === 'seleccion' ? 1.04 : 0.86;
    marcadas.forEach((t, i) => {
      dummy.position.set(t.coords.x - offset.x, t.elevacion + tileHeight(t) + 0.01, t.coords.z - offset.z);
      dummy.scale.setScalar(escala * Math.SQRT2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = marcadas.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [marcadas, offset, tipo]);

  return (
    <instancedMesh
      key={tiles.length}
      ref={ref}
      args={[marco, tipo === 'seleccion' ? matSeleccion : matResaltada, Math.max(tiles.length, 1)]}
      raycast={() => null}
    />
  );
}
