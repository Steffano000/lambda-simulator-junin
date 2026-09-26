import { Canvas } from '@react-three/fiber';
import { CameraRig } from './CameraRig';
import { GridRoot } from './GridRoot';

/** Escena 3D minimalista: luz simple, sin sombras pesadas, AO ni profundidad de campo (design.md §2). */
export function SceneCanvas() {
  return (
    <Canvas camera={{ fov: 45, near: 0.1, far: 1000 }} dpr={[1, 2]} className="bg-ui-scene">
      <hemisphereLight args={['#ffffff', '#8a7a66', 1.1]} />
      <directionalLight position={[10, 18, 8]} intensity={1.4} />
      <GridRoot />
      <CameraRig />
    </Canvas>
  );
}
