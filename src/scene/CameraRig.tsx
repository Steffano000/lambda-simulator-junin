/**
 * Paso 01/03 · Cámara God-View con límites: no atraviesa el plano base y el zoom
 * se ajusta a la diagonal del terreno al regenerar la grilla.
 */
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useSimStore } from '@/store/useSimStore';

export function CameraRig() {
  const { rows, cols } = useSimStore((s) => s.config);
  const camera = useThree((s) => s.camera);
  const diagonal = Math.hypot(rows, cols);

  useEffect(() => {
    const d = diagonal * 0.9;
    camera.position.set(d, d * 0.9, d);
    camera.lookAt(0, 0, 0);
  }, [camera, diagonal]);

  return (
    <OrbitControls
      makeDefault
      enableDamping
      target={[0, 0, 0]}
      minDistance={4}
      maxDistance={diagonal * 2.5}
      maxPolarAngle={Math.PI / 2.2}
    />
  );
}
