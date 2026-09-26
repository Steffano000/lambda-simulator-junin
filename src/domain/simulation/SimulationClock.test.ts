import { describe, expect, it } from 'vitest';
import { ClimateRepository, CropRepository, SoilRepository } from '@/data';
import { ClimateScenario } from '../climate';
import { CropFactory } from '../crops';
import type { TileNode } from '../grid';
import { TerrainFactory } from '../terrain';
import { SimulationClock } from './SimulationClock';

const crops = new CropFactory(CropRepository.all());
const terrains = new TerrainFactory(SoilRepository.all());
const clock = new SimulationClock(crops);
const escenario = (n: string) => new ClimateScenario(n, ClimateRepository.byName(n)!);
const profile = terrains.createProfile({ clase: 'Franco', reaccion: 'neutro', tamano: 'demo' });

const sembradas = (humedad = 80): TileNode[] =>
  terrains
    .createTiles(profile)
    .map((t) => ({ ...t, humedad, estado: 'sembrado' as const, vegetacionId: 'Papa', salud: 100 }));

const avanzar = (tiles: TileNode[], dias: number, esc = 'Normal 2001-02', mesInicio = 10) =>
  clock.advance({
    tiles,
    dias,
    diaInicial: 0,
    mesInicio,
    escenario: escenario(esc),
    textura: 'media',
    soilOf: SoilRepository.byClass,
  });

describe('SimulationClock', () => {
  it('calcula el mes calendario con meses de 365/12 días', () => {
    expect(SimulationClock.mesActual(10, 0)).toBe(10);
    expect(SimulationClock.mesActual(10, 31)).toBe(11);
    expect(SimulationClock.mesActual(12, 31)).toBe(1);
  });

  it('la papa llega a la etapa Final y se marca madura', () => {
    const papa = crops.create('Papa');
    const { tiles, resumen } = avanzar(sembradas(), papa.inicioFinal);
    expect(tiles[0].estado).toBe('maduro');
    expect(resumen.nuevasMaduras).toBe(tiles.length);
  });

  it('un año seco reduce más la humedad y la salud que uno lluvioso', () => {
    const seco = avanzar(sembradas(70), 60, 'Extremo seco 1991-92');
    const lluvioso = avanzar(sembradas(70), 60, 'Lluvioso / La Niña 1988-89');
    expect(seco.resumen.humedadDespues).toBeLessThanOrEqual(lluvioso.resumen.humedadDespues);
    expect(seco.resumen.saludDespues!).toBeLessThanOrEqual(lluvioso.resumen.saludDespues!);
  });

  it('el suelo desnudo pierde humedad en junio (lluvia 9.6 mm < evaporación)', () => {
    const baldias = terrains.createTiles(profile).map((t) => ({ ...t, humedad: 80 }));
    const { resumen } = avanzar(baldias, 30, 'Normal 2001-02', 6);
    expect(resumen.humedadDespues).toBeLessThan(80);
  });

  it('es determinista', () => {
    expect(avanzar(sembradas(), 45).tiles).toEqual(avanzar(sembradas(), 45).tiles);
  });
});
