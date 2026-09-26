/**
 * Paso 01 · Factory + Registry de materiales: UN material compartido por metacategoría
 * (design.md §2). El color por celda va en el color de instancia, no en materiales nuevos.
 */
import * as THREE from 'three';

export type MaterialCategory = 'terreno' | 'planta' | 'agua' | 'seleccion';

const registry = new Map<MaterialCategory, THREE.Material>();

const builders: Record<MaterialCategory, () => THREE.Material> = {
  // Flat/low-poly: sin texturas, sin AO fuerte
  terreno: () => new THREE.MeshLambertMaterial({ flatShading: true }),
  planta: () => new THREE.MeshLambertMaterial({ flatShading: true }),
  agua: () => new THREE.MeshLambertMaterial({ color: '#2F6690', transparent: true, opacity: 0.85 }),
  seleccion: () => new THREE.MeshBasicMaterial({ color: '#FFFFFF', wireframe: true }),
};

export function getMaterial(category: MaterialCategory): THREE.Material {
  let material = registry.get(category);
  if (!material) {
    material = builders[category]();
    registry.set(category, material);
  }
  return material;
}
