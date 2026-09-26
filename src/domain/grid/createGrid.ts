/**
 * Paso 01 · Inicializa la matriz lógica N×M.
 * MVP: asignación de suelo plana y determinista por semilla (la procedural llega en el paso 07).
 */
import { createRng } from '../shared/random';
import type { GridConfig } from './GridConfig';
import { AGUA_INICIAL, tileId, type TileNode } from './TileNode';

export function createGrid(config: GridConfig, soilClasses: readonly string[]): TileNode[] {
  const rng = createRng(config.seed);
  const tiles: TileNode[] = [];
  for (let z = 0; z < config.rows; z++) {
    for (let x = 0; x < config.cols; x++) {
      tiles.push({
        id: tileId(x, z),
        coords: { x, z },
        elevacion: 0,
        suelo: {
          clase: soilClasses[Math.floor(rng() * soilClasses.length)],
          ph: +(5 + rng() * 2.5).toFixed(1),
          n: Math.round(20 + rng() * 60),
          p: Math.round(10 + rng() * 40),
          k: Math.round(80 + rng() * 170),
          materiaOrganica: +(1 + rng() * 3).toFixed(1),
        },
        humedad: Math.round(20 + rng() * 60),
        vegetacionId: null,
        estado: 'baldio',
        diasCultivo: 0,
        canal: false,
        salud: 100,
        ...AGUA_INICIAL,
      });
    }
  }
  return tiles;
}
