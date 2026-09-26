/** El perfil y las celdas iniciales salen de la mezcla, no de una sola clase. */
import { describe, expect, it } from 'vitest';
import { SoilMixRepository, SoilRepository } from '@/data';
import type { MezclaSuelos } from '@/data/types';
import { TerrainFactory } from './TerrainFactory';
import { repartoReal } from './soilDistribution';

const terrains = new TerrainFactory(SoilRepository.all(), SoilMixRepository.all());
const mezcla = (porcentajes: Record<string, number>): MezclaSuelos => ({
  id: 'prueba',
  nombre: 'Prueba',
  descripcion: '',
  porcentajes,
});

describe('TerrainFactory', () => {
  it('valida el catálogo de mezclas al construir', () => {
    expect(terrains.mezclas.map((m) => m.id)).toEqual(SoilMixRepository.all().map((m) => m.id));
    expect(terrains.mezclaPorDefecto().id).toBe(SoilMixRepository.all()[0].id);
  });

  it('avisa si la mezcla menciona una clase que no existe', () => {
    expect(() => new TerrainFactory(SoilRepository.all(), [mezcla({ Inventada: 100 })])).toThrow(/Inventada/);
  });

  it('el perfil toma la clase dominante y su textura', () => {
    const perfil = terrains.createProfile({
      mezcla: mezcla({ Arena: 30, 'Franco arcilloso': 70 }),
      reaccion: 'acido',
      tamano: 'demo',
    });
    expect(perfil.clase).toBe('Franco arcilloso');
    expect(perfil.textura).toBe('pesada');
    expect(perfil.phBase).toBe(5.2);
    expect(perfil.variedadClases).toBe(2);
    expect(perfil.descripcion).toContain('70%');
  });

  it('reparte la mezcla por la grilla y mantiene la variación de pH', () => {
    const perfil = terrains.createProfile({
      mezcla: terrains.mezclaPorId('vega')!.datos,
      reaccion: 'neutro',
      tamano: 'demo',
    });
    const tiles = terrains.createTiles(perfil);
    const real = repartoReal(tiles.map((t) => t.suelo.clase));

    expect(Object.keys(real).length).toBeGreaterThan(1);
    expect(Math.abs(real.Arena - 25)).toBeLessThan(2);
    expect(new Set(tiles.map((t) => t.suelo.ph)).size).toBeGreaterThan(1);
    expect(tiles.every((t) => t.estado === 'baldio')).toBe(true);
  });

  it('el reparto es determinista con la misma semilla', () => {
    const opciones = {
      mezcla: mezcla({ Franco: 50, Arena: 50 }),
      reaccion: 'neutro',
      tamano: 'demo',
    } as const;
    const clases = (seed?: number) =>
      terrains.createTiles(terrains.createProfile({ ...opciones, seed })).map((t) => t.suelo.clase);
    expect(clases(99)).toEqual(clases(99));
    expect(clases(99)).not.toEqual(clases(100));
  });

  it('el perfil recuerda la estrategia de reparto elegida', () => {
    const perfil = terrains.createProfile({
      mezcla: mezcla({ Franco: 100 }),
      reaccion: 'neutro',
      tamano: 'demo',
      distribucion: 'aleatorio',
    });
    expect(perfil.distribucion).toBe('aleatorio');
    expect(terrains.createTiles(perfil)).toHaveLength(perfil.config.rows * perfil.config.cols);
  });
});
