/**
 * Escritor de instancias: el ÚNICO lugar de la escena que conoce la mecánica de
 * `InstancedMesh` (matrices, colores, `count`, banderas de GPU).
 *
 * Cada modelo 3D describe solo su geometría —dónde va y de qué color— y delega aquí el
 * cómo se escribe, de modo que añadir un modelo nuevo no repita el bucle de instancing.
 */
import * as THREE from 'three';

/**
 * Objetos de trabajo compartidos por todas las capas. Se reutilizan para no asignar un
 * `Object3D`/`Color` por celda y por fotograma (1600 celdas × 3 capas).
 */
const dummy = new THREE.Object3D();
const tint = new THREE.Color();

export class InstanceBatch {
  constructor(private readonly mesh: THREE.InstancedMesh) {}

  /** Coloca la instancia `i` con base en (x, y, z) y escala (sx, sy, sz). */
  place(i: number, x: number, y: number, z: number, sx: number, sy = 1, sz = sx): void {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(i, dummy.matrix);
  }

  /** Matriz ya compuesta (con rotación): para modelos de varias piezas orientadas. */
  placeMatrix(i: number, matrix: THREE.Matrix4): void {
    this.mesh.setMatrixAt(i, matrix);
  }

  /** Escalado uniforme: para marcas y elementos sin proporción propia. */
  placeScaled(i: number, x: number, y: number, z: number, escala: number): void {
    this.place(i, x, y, z, escala);
  }

  /** Color de la instancia (rampa estado→visual); el material no se toca. */
  paint(i: number, color: string): void {
    this.mesh.setColorAt(i, tint.set(color));
  }

  /** Publica los cambios y limita el dibujo a las instancias escritas. */
  commit(dibujadas: number): void {
    this.mesh.count = dibujadas;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
