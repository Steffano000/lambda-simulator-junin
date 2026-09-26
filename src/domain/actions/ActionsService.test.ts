import { describe, expect, it } from 'vitest';
import { ClimateRepository, CropRepository, SoilMixRepository, SoilRepository } from '@/data';
import { CropFactory } from '../crops';
import type { TileNode } from '../grid';
import { SoilHydraulics } from '../hydrology';
import { TerrainFactory } from '../terrain';
import { ActionsService } from './ActionsService';
import { CommandFactory, TOOL_IDS } from './CommandFactory';
import { PlantingValidator } from './PlantingValidator';
import type { ActionContext } from './TileCommand';

const crops = new CropFactory(CropRepository.all());
const terrains = new TerrainFactory(SoilRepository.all(), SoilMixRepository.all());
const papa = crops.create('Papa');
const clima = ClimateRepository.byName('Normal 2001-02')!;
const service = new ActionsService();
const validator = new PlantingValidator(service);

const ctx = (over: Partial<ActionContext> = {}): ActionContext => ({
  crop: papa,
  dia: 0,
  mes: 10,
  clima: clima[9],
  cropOf: (n) => crops.find(n),
  soilOf: SoilRepository.byClass,
  hidraulica: (clase) => {
    const suelo = SoilRepository.byClass(clase);
    return suelo ? SoilHydraulics.of(suelo) : undefined;
  },
  direccionArado: 'x',
  ...over,
});

/** Perfil de una sola clase: parcela homogénea para pruebas deterministas. */
const perfil = (clase = 'Franco', reaccion: 'acido' | 'neutro' | 'alcalino' = 'neutro') =>
  terrains.createProfile({
    mezcla: {
      id: 'homogenea',
      nombre: 'Homogénea',
      descripcion: `${clase} al 100 %`,
      porcentajes: { [clase]: 100 },
    },
    reaccion,
    tamano: 'demo',
  });

/** Parcela 10×10 homogénea para pruebas deterministas. */
const grid = (suelo: Partial<TileNode['suelo']> = {}, humedad = 80): TileNode[] =>
  terrains.createTiles(perfil()).map((t) => ({
    ...t,
    humedad,
    suelo: { ...t.suelo, ph: 5.5, n: 70, materiaOrganica: 3.5, ...suelo },
  }));

const ids = (tiles: TileNode[], n: number) => tiles.slice(0, n).map((t) => t.id);

describe('CommandFactory', () => {
  it('crea un comando por herramienta, lo reutiliza y separa por categoría', () => {
    const factory = new CommandFactory();
    for (const id of TOOL_IDS) expect(factory.create(id)).toBe(factory.create(id));
    expect(factory.ids('plantacion')).toEqual(['sembrar', 'cosechar', 'remover', 'descansar']);
  });
});

describe('Acciones disponibles según terreno y estado', () => {
  it('en un terreno baldío no ofrece abonos (requieren arar) y drenar solo en suelo pesado', () => {
    const baldio = grid();
    const medio = service.disponibles('tratamiento', perfil('Franco'), baldio, ctx()).map((d) => d.id);
    expect(medio).toContain('arar');
    expect(medio).not.toContain('abonar-organico');
    expect(medio).not.toContain('drenar');

    const pesado = service.disponibles('tratamiento', perfil('Arcilla'), baldio, ctx()).map((d) => d.id);
    expect(pesado).toContain('drenar');
  });

  it('tras arar aparecen los abonos', () => {
    const tiles = service.executeMany('arar', ids(grid(), 5), grid(), ctx()).tiles;
    const disponibles = service.disponibles('tratamiento', perfil(), tiles, ctx()).map((d) => d.id);
    expect(disponibles).toContain('abonar-quimico');
  });
});

describe('Aplicación por área', () => {
  it('aplica a las celdas válidas y omite el resto con motivo, sin bloquearlas', () => {
    const base = grid();
    const arada = service.executeMany('arar', ids(base, 2), base, ctx()).tiles;
    const r = service.executeMany('arar', ids(arada, 4), arada, ctx());
    expect(r.aplicadas).toHaveLength(2);
    expect(r.omitidas).toHaveLength(2);
    expect(r.omitidas[0].motivo).toBe('La celda ya está arada.');
  });

  it('encalar sube el pH y acidificar lo baja', () => {
    const base = grid();
    const encalado = service.executeMany('encalar', ids(base, 1), base, ctx()).tiles;
    expect(encalado[0].suelo.ph).toBe(6);
    const acidificado = service.executeMany('acidificar', ids(encalado, 1), encalado, ctx()).tiles;
    expect(acidificado[0].suelo.ph).toBe(5.5);
  });

  it('regar sube más la humedad en arena que en arcilla', () => {
    const con = (clase: string) => grid({ clase }, 30);
    const arena = service.execute('regar', '0:0', con('Arena'), ctx()).tiles[0].humedad;
    const arcilla = service.execute('regar', '0:0', con('Arcilla'), ctx()).tiles[0].humedad;
    expect(arena).toBeGreaterThan(arcilla);
  });

  it('el canal humedece vecinas de forma decreciente con la distancia', () => {
    const base = grid({}, 40);
    const tiles = service.execute('canal', '5:5', base, ctx()).tiles;
    const h = (id: string) => tiles.find((t) => t.id === id)!.humedad;
    expect(h('5:5')).toBe(100);
    expect(h('6:5')).toBeGreaterThan(h('7:5'));
    expect(h('8:5')).toBe(40);
  });
});

describe('Validación de prerrequisitos y plantación', () => {
  it('separa celdas listas de las que requieren tratamiento y sugiere la herramienta', () => {
    const base = grid();
    const aradas = service.executeMany('arar', ids(base, 4), base, ctx()).tiles;
    // Dos celdas con pH alto para Papa (óptimo 5–6.2)
    const tiles = aradas.map((t, i) => (i < 2 ? { ...t, suelo: { ...t.suelo, ph: 7.4 } } : t));
    const v = validator.validar(papa, tiles.slice(0, 4), ctx());

    expect(v.listas).toEqual(['2:0', '3:0']);
    expect(v.aCorregir).toEqual(['0:0', '1:0']);
    expect(v.pendientes[0].requisito.id).toBe('ph-alto');
    expect(v.pendientes[0].herramientas).toContain('acidificar');
  });

  it('una celda sin arar no bloquea la siembra en las demás', () => {
    const base = grid();
    const tiles = service.executeMany('arar', ids(base, 3), base, ctx()).tiles;
    const r = service.executeMany('sembrar', ids(tiles, 4), tiles, ctx());
    expect(r.aplicadas).toHaveLength(3);
    expect(r.omitidas[0].motivo).toMatch(/Falta arar/);
  });

  it('bloquea la siembra fuera del mes de siembra', () => {
    const base = grid();
    const tiles = service.executeMany('arar', ids(base, 1), base, ctx()).tiles;
    const v = validator.validar(papa, tiles.slice(0, 1), ctx({ mes: 3, clima: clima[2] }));
    expect(v.bloqueosCultivo[0]).toMatch(/se siembra en Oct/);
  });

  it('la Haba fija nitrógeno: no exige N mínimo', () => {
    const haba = crops.create('Haba (grano seco)');
    expect(haba.requisitos.map((r) => r.id)).not.toContain('nitrogeno');
    expect(papa.requisitos.map((r) => r.id)).toContain('nitrogeno');
  });
});
