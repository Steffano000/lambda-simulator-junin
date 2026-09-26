/**
 * Cámara God-View con límites: no atraviesa el plano base y el zoom se ajusta a la
 * diagonal del terreno. El botón izquierdo queda libre para seleccionar celdas:
 * clic derecho gira, botón central desplaza y la rueda acerca.
 */
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useSimStore } from '@/store/useSimStore';

/** Sin acción: OrbitControls ignora el botón izquierdo. */
const NINGUNA = -1 as THREE.MOUSE;

const BOTONES = { LEFT: NINGUNA, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };

/** Límites de la órbita: por debajo de `minDistance` se ve la celda de cerca. */
const ORBITA = {
  distanciaMin: 4,
  /** Multiplicador de la diagonal: margen para ver la parcela completa. */
  factorMax: 2.5,
  /** No baja del horizonte: la cámara no atraviesa el plano base. */
  anguloPolarMax: Math.PI / 2.2,
} as const;

/** Encuadre inicial: la diagonal marca la escala de la parcela. */
const GOD_VIEW = { factor: 0.9, altura: 0.9 } as const;

export function CameraRig() {
  const { rows, cols } = useSimStore((s) => s.config);
  const camera = useThree((s) => s.camera);
  const diagonal = Math.hypot(rows, cols);

  useEffect(() => {
    const d = diagonal * GOD_VIEW.factor;
    camera.position.set(d, d * GOD_VIEW.altura, d);
    camera.lookAt(0, 0, 0);
  }, [camera, diagonal]);

  return (
    <OrbitControls
      makeDefault
      enableDamping
      mouseButtons={BOTONES}
      target={[0, 0, 0]}
      minDistance={ORBITA.distanciaMin}
      maxDistance={diagonal * ORBITA.factorMax}
      maxPolarAngle={ORBITA.anguloPolarMax}
    />
  );
}
