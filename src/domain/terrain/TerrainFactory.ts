/**
 * Factory de terrenos: construye el perfil (Builder de parámetros) y la grilla inicial
 * de celdas a partir de él. Determinista: mismos parámetros + semilla → misma parcela.
 *
 * La parcela ya no es de una sola clase: la mezcla (data/terrenos_mezclas.json) reparte
 * las clases por la grilla y cada celda conserva su clase, que es la que usa la
 * hidrología y los comandos. Ver docs/07-topografia-procedural.md.
 */
import type { MezclaSuelos, Terreno } from '@/data/types';
import { AGUA_INICIAL, GridConfigBuilder, tileId, type SizePreset, type TileNode } from '../grid';
import { createRng } from '../shared/random';
import { TerrainProfile, type ReaccionPh } from './TerrainProfile';
import { DISTRIBUCION_POR_DEFECTO, repartirSuelos, type ClaveDistribucion } from './soilDistribution';
import { SoilMix } from './soilMix';

export interface TerrainOptions {
  /** Mezcla de suelos de la parcela (id, nombre y porcentajes editables). */
  mezcla: Readonly<MezclaSuelos>;
  reaccion: ReaccionPh;
  tamano: SizePreset;
  /** Estrategia de reparto por la grilla. Por defecto, manchones coherentes. */
  distribucion?: ClaveDistribucion;
  seed?: number;
}

/** Variación natural entre celdas de una misma parcela. */
const VARIACION = { ph: 0.6, humedadMin: 30, humedadMax: 70, nMin: 20, nMax: 60 } as const;

export class TerrainFactory {
  /** Mezclas del catálogo, ya validadas contra las clases de suelo disponibles. */
  readonly mezclas: readonly SoilMix[];

  constructor(
    private readonly suelos: readonly Terreno[],
    mezclas: readonly MezclaSuelos[],
  ) {
    this.mezclas = mezclas.map((datos) => {
      const mezcla = SoilMix.de(datos);
      for (const { clase } of mezcla.partes()) this.sueloDe(clase);
      return mezcla;
    });
  }

  clases(): readonly Terreno[] {
    return this.suelos;
  }

  /** Suelo del catálogo por clase. Lanza si la mezcla menciona una clase inexistente. */
  private sueloDe(clase: string): Terreno {
    const suelo = this.suelos.find((s) => s.clase === clase);
    if (!suelo) throw new Error(`Clase de suelo desconocida: "${clase}".`);
    return suelo;
  }

  /** Mezcla del catálogo por id (para el selector de presets de la UI). */
  mezclaPorId(id: string): SoilMix | undefined {
    return this.mezclas.find((m) => m.id === id);
  }

  /** Mezcla inicial: la primera del catálogo. */
  mezclaPorDefecto(): SoilMix {
    const [primera] = this.mezclas;
    if (!primera) throw new Error('El catálogo de mezclas de suelos está vacío.');
    return primera;
  }

  createProfile({
    mezcla,
    reaccion,
    tamano,
    distribucion = DISTRIBUCION_POR_DEFECTO,
    seed = 2026,
  }: TerrainOptions): TerrainProfile {
    const soilMix = SoilMix.de(mezcla);
    if (soilMix.partes().length === 0)
      throw new Error(`La mezcla "${mezcla.id}" no define ninguna clase de suelo.`);
    const dominante = this.sueloDe(soilMix.dominante);
    const config = new GridConfigBuilder().preset(tamano).seed(seed).build();
    return new TerrainProfile(dominante, reaccion, config, soilMix, distribucion);
  }

  /**
   * Celdas iniciales: baldías con la clase que le toca según la mezcla, y pH/humedad/N
   * variables como antes.
   */
  createTiles(profile: TerrainProfile): TileNode[] {
    const { rows, cols, seed } = profile.config;
    const rng = createRng(seed);
    const between = (min: number, max: number) => min + rng() * (max - min);
    const reparto = repartirSuelos(profile.mezcla, profile.config, profile.distribucion, seed);
    const tiles: TileNode[] = [];

    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        tiles.push({
          id: tileId(x, z),
          coords: { x, z },
          elevacion: 0,
          suelo: {
            clase: reparto[z * cols + x],
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
          ...AGUA_INICIAL,
        });
      }
    }
    return tiles;
  }
}
