/** Paso 01 · Nodo lógico de la grilla. Única fuente de verdad; la malla es solo su proyección. */
export interface Coords {
  /** Columna (eje X) */
  x: number;
  /** Fila (eje Z) */
  z: number;
}

export interface SoilState {
  /** `clase` de data/terrenos.json */
  clase: string;
  ph: number;
  n: number;
  p: number;
  k: number;
  materiaOrganica: number;
}

export interface TileNode {
  id: string;
  coords: Coords;
  /** Altura del bloque (eje Y, en cubos de 1 m). 0 = planicie; funcional desde el paso 07. */
  elevacion: number;
  suelo: SoilState;
  /** Humedad 0–100 % (0 = PMP, 100 = CC) */
  humedad: number;
  /** `nombre` de data/cultivos.json o null */
  vegetacionId: string | null;
}

export const tileId = (x: number, z: number): string => `${x}:${z}`;
