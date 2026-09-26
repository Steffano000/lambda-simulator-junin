/**
 * Factory de terrenos: construye el perfil (Builder de parámetros) y la grilla inicial
 * de celdas a partir de él. Determinista: mismo perfil + semilla → misma parcela.
 */
import type { Terreno } from '@/data/types';
import { GridConfigBuilder, tileId, type SizePreset, type TileNode } from '../grid';
import { createRng } from '../shared/random';
import { TerrainProfile, type ReaccionPh } from './TerrainProfile';

export interface TerrainOptions {
  clase: string;
  reaccion: ReaccionPh;
  tamano: SizePreset;
  seed?: number;
}

/** Variación natural entre celdas de una misma parcela. */
const VARIACION = { ph: 0.6, humedadMin: 30, humedadMax: 70, nMin: 20, nMax: 60 } as const;

export class TerrainFactory {
  constructor(private readonly suelos: readonly Terreno[]) {}

  clases(): readonly Terreno[] {
    return this.suelos;
  }

  createProfile({ clase, reaccion, tamano, seed = 2026 }: TerrainOptions): TerrainProfile {
    const suelo = this.suelos.find((s) => s.clase === clase);
    if (!suelo) throw new Error(`Clase de suelo desconocida: "${clase}".`);
    const config = new GridConfigBuilder().preset(tamano).seed(seed).build();
    return new TerrainProfile(suelo, reaccion, config);
  }

  /** Celdas iniciales: baldías, con la textura del perfil y pH/humedad/N variables. */
  createTiles(profile: TerrainProfile): TileNode[] {
    const { rows, cols, seed } = profile.config;
    const rng = createRng(seed);
    const between = (min: number, max: number) => min + rng() * (max - min);
    const tiles: TileNode[] = [];

    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        tiles.push({
          id: tileId(x, z),
          coords: { x, z },
          elevacion: 0,
          suelo: {
            clase: profile.clase,
            ph: +(profile.phBase + between(-VARIACION.ph, VARIACION.ph)).toFixed(1),
            n: Math.round(between(VARIACION.nMin, VARIACION.nMax)),
            p: Math.round(between(10, 40)),
            k: Math.round(between(80, 250)),
            materiaOrganica: +between(1, 3).toFixed(1),
          },
          humedad: Math.round(between(VARIACION.humedadMin, VARIACION.humedadMax)),
          vegetacionId: null,
          estado: 'baldio',
          diasCultivo: 0,
          canal: false,
          salud: 100,
        });
      }
    }
    return tiles;
  }
}
