/**
 * Geometrías unitarias de las piezas de los cultivos y composición de su matriz.
 * Compartidas por la capa instanciada del terreno y la vista previa de la fase de cultivos.
 *
 * Pivote: caja, cono y cilindro se apoyan en su base (y = 0); la esfera, en su centro.
 * Rotación con orden YXZ: primero se inclina la pieza y luego se orienta alrededor del eje
 * vertical (así una hoja "se abre" hacia fuera en la dirección de `rot[1]`).
 */
import * as THREE from 'three';
import type { Forma, Pieza } from './cropModels';

export const GEOMETRIA: Record<Forma, THREE.BufferGeometry> = {
  caja: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cono: new THREE.ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0),
  cilindro: new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0),
  esfera: new THREE.IcosahedronGeometry(0.5, 0),
};

export const FORMAS: readonly Forma[] = ['caja', 'cono', 'cilindro', 'esfera'];

const tmpPos = new THREE.Vector3();
const tmpEsc = new THREE.Vector3();
const tmpRot = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpQuat = new THREE.Quaternion();
const local = new THREE.Matrix4();
const planta = new THREE.Matrix4();

/**
 * Matriz de mundo de una pieza: celda (x, y, z) → giro propio de la planta (`yaw`) →
 * posición, rotación y escala de la pieza.
 */
export function matrizPieza(
  p: Pieza,
  x: number,
  y: number,
  z: number,
  yaw: number,
  out = new THREE.Matrix4(),
) {
  tmpRot.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ');
  local.compose(tmpPos.set(...p.pos), tmpQuat.setFromEuler(tmpRot), tmpEsc.set(...p.esc));
  planta.makeRotationY(yaw).setPosition(x, y, z);
  return out.multiplyMatrices(planta, local);
}

/** Giro estable por celda (0–2π) para que el campo no se vea clonado. */
export function yawDe(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}
