/**
 * Paso 01 · EP-01.2 · Adapter sobre GLTFLoader + DRACOLoader.
 * - Normaliza escala a 1 celda y pivote al centro-inferior.
 * - Si el asset falla, devuelve una primitiva colorida: nunca rompe el render loop.
 */
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const draco = new DRACOLoader().setDecoderPath('/draco/');
const gltf = new GLTFLoader().setDRACOLoader(draco);
const cache = new Map<string, Promise<THREE.Object3D>>();

function normalize(object: THREE.Object3D, cellSize = 1): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = cellSize / Math.max(size.x, size.y, size.z, 1e-6);
  object.scale.setScalar(scale);
  box.setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  return object;
}

export function fallbackPrimitive(color = '#009E73'): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, 0.6, 6),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
  );
  mesh.position.y = 0.3;
  return mesh;
}

export function loadAsset(url: string, onProgress?: (pct: number) => void): Promise<THREE.Object3D> {
  const cached = cache.get(url);
  if (cached) return cached.then((o) => o.clone());

  const promise = gltf
    .loadAsync(url, (e) => e.total && onProgress?.((e.loaded / e.total) * 100))
    .then((g) => normalize(g.scene))
    .catch((err) => {
      console.warn(`[AssetLoader] ${url} no disponible, usando primitiva.`, err);
      return fallbackPrimitive();
    });
  cache.set(url, promise);
  return promise.then((o) => o.clone());
}
