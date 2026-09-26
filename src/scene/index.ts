/**
 * Capa 3D (Three.js). Cada modelo —bloque de terreno, cultivo, marca, cámara, luz— es un
 * módulo autónomo en su carpeta: la geometría y su mapeo estado → visual van juntos, y la
 * infraestructura común (instancing, materiales, magnitudes) se resuelve por props desde
 * @/scene/render.
 *
 * Este barrel es la API pública de la escena; la UI entra por `SceneCanvas`. Los .glb se
 * cargan con @/scene/assets, que no se reexporta aquí para no meter GLTF/DRACO en el
 * bundle de quien solo dibuja la grilla.
 */
export { SceneCanvas } from './SceneCanvas';
export { CameraRig } from './camera';
export { GridRoot, TileField, useTilePicking, type TilePicking } from './grid';
export { PlantsLayer } from './crops';
export { SelectionLayer, type TipoMarca } from './markers';
export { Lighting } from './lighting';
export { getMaterial, type MaterialCategory } from './render';
export { tileColor, tileHeight } from './tiles';
