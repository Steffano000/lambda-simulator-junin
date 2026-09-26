/**
 * Parte visual del cielo: cálculo puro, sin React ni escena. La niebla se mide desde la
 * cámara —no desde la parcela— porque si el rango cae más lejos que la grilla el tinte no
 * tiñe nada y el color del tiempo no se aprecia.
 */
import * as THREE from 'three';

/** Rapidez del cambio de color (1/s): más alto, transición más corta. */
const TRANSICION = 2.5;

/** Niebla en múltiplos de la distancia de la cámara al centro de la parcela. */
const NIEBLA = { cerca: 0.9, lejos: 3 } as const;

/** Distancia mínima para que el rango de niebla nunca se degeneren. */
const DISTANCIA_MINIMA = 1;

/** Un cambio por debajo de esto no se nota: no vale la pena repintar. */
const UMBRAL = 0.002;

/** `delta` máximo del paso: tras una pausa larga (pestaña en segundo plano) no salta. */
const DELTA_MAX = 0.1;

/**
 * Un paso de la transición: acerca `actual` a `destino` con amortiguación exponencial.
 * Devuelve si el color se movió lo bastante como para repintar.
 */
export function avanzarColor(actual: THREE.Color, destino: THREE.Color, delta: number): boolean {
  const antes = actual.r + actual.g + actual.b;
  actual.lerp(destino, 1 - Math.exp(-TRANSICION * Math.min(delta, DELTA_MAX)));
  return Math.abs(actual.r + actual.g + actual.b - antes) > UMBRAL;
}

/** Rango de niebla para una cámara a `distancia` del centro: leve, da profundidad. */
export function rangosNiebla(distancia: number): { near: number; far: number } {
  const d = Math.max(distancia, DISTANCIA_MINIMA);
  return { near: d * NIEBLA.cerca, far: d * NIEBLA.lejos };
}
