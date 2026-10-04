/**
 * Escena 3D minimalista: luz simple, sin sombras pesadas, AO ni profundidad de campo
 * (design.md §2). Compone los modelos por módulo —cielo, luz, terreno, clima, cámara— sin que
 * este archivo conozca su implementación: cada modelo se añade o cambia en su carpeta.
 */
import { Canvas } from '@react-three/fiber';
import { CameraRig } from './camera';
import { GridRoot } from './grid';
import { Lighting } from './lighting';
import { Sky } from './sky';
import { WeatherLayer } from './weather';

/** Cámara inicial; el encuadre definitivo lo pone CameraRig al leer la config. */
const CAMERA = { fov: 45, near: 0.1, far: 1000 } as const;

/** Nitidez según el dispositivo: hasta 2× en pantallas densas. */
const DPR: [number, number] = [1, 2];

export function SceneCanvas() {
  // El mapa de sombras queda habilitado: solo proyectan las nubes y solo si la vista lo pide
  // (cambiar `shadows` en caliente no recompila los materiales ya creados)
  return (
    <Canvas camera={CAMERA} dpr={DPR} shadows className="bg-ui-scene">
      <Sky />
      <Lighting />
      <GridRoot />
      <WeatherLayer />
      <CameraRig />
    </Canvas>
  );
}
