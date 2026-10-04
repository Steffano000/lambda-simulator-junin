/**
 * `<instancedMesh>` declarativo: una malla instanciada por modelo 3D.
 *
 * Concentra el andamiaje que estaba repetido en cada capa (ref, `useLayoutEffect` de
 * escritura, `count`, `needsUpdate`, `raycast` nulo y `dispose` desactivado), de modo que
 * un modelo nuevo sea su geometría + su `place`/`paint` (design.md §2: instancing y un
 * solo material por metacategoría).
 *
 * Dos cuidados que esta pieza resuelve una sola vez:
 *  - La capacidad de una `InstancedMesh` es fija: se fija con `capacity` y cambiarla
 *    remonta la malla. Sin ella, las capas decorativas (que dibujan menos items de los
 *    que caben) se remontarían cada vez que cambiara su filtro.
 *  - `dispose={null}`: geometría y material son singletons compartidos entre capas y
 *    montajes; que R3F los destruyera al desmontar dejaría la siguiente capa sin GPU.
 */
import { useLayoutEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { InstanceBatch } from './instanceBatch';

/** Sin raycast: las capas decorativas no capturan el puntero; el clic va al bloque. */
const SIN_RAYCAST = () => null;

const EMPTY: readonly unknown[] = [];

export interface InstancePointer {
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMissed?: (e: MouseEvent) => void;
}

export interface InstanceFieldProps<T> extends InstancePointer {
  /** Geometría compartida por todas las instancias. */
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Instancias a escribir, en orden. */
  items: readonly T[];
  /** Instancias que caben en la malla. Por defecto, `items.length`. */
  capacity?: number;
  /** Escribe la transformación de la instancia `i`. */
  place: (batch: InstanceBatch, item: T, i: number) => void;
  /** Color por instancia. Sin esta función, manda el color del material. */
  paint?: (item: T) => string;
  /** Con puntero: la capa es interactiva. Sin él, `raycast` queda anulado. */
  interactive?: boolean;
  /** Valores de los que dependen `place`/`paint` y que deben forzar el redibujo. */
  deps?: readonly unknown[];
  /** Sombras (apagadas salvo que la vista las pida: sombra de nubes, Fase 4) */
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function InstanceField<T>({
  geometry,
  material,
  items,
  capacity,
  place,
  paint,
  interactive,
  deps = EMPTY,
  castShadow = false,
  receiveShadow = false,
  ...pointer
}: InstanceFieldProps<T>) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // `place`/`paint` llegan como closures nuevas en cada render: se leen de aquí para no
  // atar el efecto a su identidad, y el redibujo se dispara con `items` + `deps`.
  const draw = useRef({ place, paint });

  const caben = Math.max(capacity ?? items.length, 1);

  useLayoutEffect(() => {
    draw.current = { place, paint };
    const mesh = ref.current;
    if (!mesh) return;
    const batch = new InstanceBatch(mesh);
    items.forEach((item, i) => {
      draw.current.place(batch, item, i);
      const color = draw.current.paint?.(item);
      if (color !== undefined) batch.paint(i, color);
    });
    batch.commit(items.length);
    // `deps` declara a mano lo que dependen `place`/`paint`; sin eso el aviso de
    // dependencia es ruido y el redibujo quedaría atado a las opciones del render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, geometry, material, caben, ...deps]);

  return (
    <instancedMesh
      key={caben}
      ref={ref}
      args={[geometry, material, caben]}
      dispose={null}
      raycast={interactive ? undefined : SIN_RAYCAST}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      {...pointer}
    />
  );
}
