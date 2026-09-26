/**
 * Paso 01 · Factory + Registry de materiales: UN material compartido por metacategoría
 * (design.md §2). El color por celda va en el color de instancia, no en materiales nuevos:
 * por eso las capas piden `getMaterial(categoría)` y nunca construyen el suyo.
 *
 * Los colores salen de src/theme/tokens.ts (fuente única), también los de la escena.
 */
import * as THREE from 'three';
import { marcador, surface } from '@/theme/tokens';

export type MaterialCategory =
  'terreno' | 'planta' | 'planta-fantasma' | 'agua' | 'nube' | 'seleccion' | 'resaltada';

const registry = new Map<MaterialCategory, THREE.Material>();

const builders: Record<MaterialCategory, () => THREE.Material> = {
  // Flat/low-poly: sin texturas, sin AO fuerte
  terreno: () => new THREE.MeshLambertMaterial({ flatShading: true }),
  planta: () => new THREE.MeshLambertMaterial({ flatShading: true }),
  // Vista previa del cultivo en la fase de cultivos: translúcida, no tapa el terreno
  'planta-fantasma': () =>
    new THREE.MeshLambertMaterial({ flatShading: true, transparent: true, opacity: 0.45, depthWrite: false }),
  agua: () => new THREE.MeshLambertMaterial({ color: surface.agua, transparent: true, opacity: 0.85 }),
  nube: () => new THREE.MeshLambertMaterial({ flatShading: true, transparent: true, opacity: 0.92 }),
  seleccion: () =>
    new THREE.MeshBasicMaterial({ color: marcador.seleccion, transparent: true, opacity: 0.95 }),
  resaltada: () => new THREE.MeshBasicMaterial({ color: marcador.resaltada }),
};

export function getMaterial(category: MaterialCategory): THREE.Material {
  let material = registry.get(category);
  if (!material) {
    material = builders[category]();
    registry.set(category, material);
  }
  return material;
}
