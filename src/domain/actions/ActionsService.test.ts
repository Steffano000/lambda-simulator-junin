import { describe, expect, it } from 'vitest';
import { ClimateRepository, CropRepository, SoilRepository } from '@/data';
import { CropFactory } from '../crops';
import { createGrid, GridConfigBuilder, type TileNode } from '../grid';
import { SimulationClock } from '../simulation';
import { ActionsService } from './ActionsService';
import { CommandFactory, TOOL_IDS } from './CommandFactory';
import type { ActionContext } from './TileCommand';

const crops = new CropFactory(CropRepository.all());
const papa = crops.create('Papa');
const clima = ClimateRepository.byName('Normal 2001-02')!;

const ctx = (over: Partial<ActionContext> = {}): ActionContext => ({
  crop: papa,
  dia: 0,
  mes: 10,
  clima: clima[9],
  cropOf: (n) => crops.find(n),
  soilOf: SoilRepository.byClass,
  ...over,
});

const grid = (): TileNode[] =>
  createGrid(new GridConfigBuilder().size(5, 5).seed(7).build(), ['Franco']).map((t) => ({
    ...t,
    suelo: { ...t.suelo, ph: 5.5 },
    humedad: 40,
  }));

const service = new ActionsService();

describe('CommandFactory', () => {
  it('crea un comando por cada herramienta y los reutiliza', () => {
    const factory = new CommandFactory();
    for (const id of TOOL_IDS) expect(factory.create(id)).toBe(factory.create(id));
  });
});

describe('ActionsService · ciclo de la celda', () => {
  it('bloquea sembrar sin arar, con motivo', () => {
    const r = service.execute('sembrar', '0:0', grid(), ctx());
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/Are la celda/);
  });

  it('arar → sembrar → madurar → cosechar', () => {
    let tiles = service.execute('arar', '0:0', grid(), ctx()).tiles;
    const sembrado = service.execute('sembrar', '0:0', tiles, ctx());
    expect(sembrado.ok).toBe(true);
    tiles = sembrado.tiles;
    expect(tiles[0]).toMatchObject({ vegetacionId: 'Papa', estado: 'sembrado' });

    expect(service.execute('cosechar', '0:0', tiles, ctx()).ok).toBe(false);

    tiles = new SimulationClock(crops).advance(tiles, papa.inicioFinal);
    expect(tiles[0].estado).toBe('maduro');

    const cosecha = service.execute('cosechar', '0:0', tiles, ctx());
    expect(cosecha.ok).toBe(true);
    expect(cosecha.cosecha?.kg).toBeCloseTo(papa.rendimientoRefKgM2, 2);
    expect(cosecha.tiles[0]).toMatchObject({ vegetacionId: null, estado: 'cosechado' });
  });

  it('no permite arar con cultivo maduro sin cosechar', () => {
    let tiles = service.execute('arar', '0:0', grid(), ctx()).tiles;
    tiles = service.execute('sembrar', '0:0', tiles, ctx()).tiles;
    tiles = new SimulationClock(crops).advance(tiles, 200);
    expect(service.execute('arar', '0:0', tiles, ctx()).mensaje).toBe('Coseche antes de arar.');
  });

  it('bloquea la siembra fuera del mes de siembra del cultivo', () => {
    const tiles = service.execute('arar', '0:0', grid(), ctx()).tiles;
    const r = service.execute('sembrar', '0:0', tiles, ctx({ mes: 3, clima: clima[2] }));
    expect(r.ok).toBe(false);
    expect(r.mensaje).toMatch(/se siembra en Oct/);
  });

  it('abonar exige suelo arado y suma N-P-K', () => {
    expect(service.execute('abonar-quimico', '0:0', grid(), ctx()).ok).toBe(false);
    const arado = service.execute('arar', '0:0', grid(), ctx()).tiles;
    const r = service.execute('abonar-quimico', '0:0', arado, ctx());
    expect(r.tiles[0].suelo.n).toBe(arado[0].suelo.n + 30);
  });

  it('regar sube más la humedad en arena que en arcilla', () => {
    const base = grid();
    const con = (clase: string) => base.map((t) => ({ ...t, suelo: { ...t.suelo, clase } }));
    const arena = service.execute('regar', '0:0', con('Arena'), ctx()).tiles[0].humedad;
    const arcilla = service.execute('regar', '0:0', con('Arcilla'), ctx()).tiles[0].humedad;
    expect(arena).toBeGreaterThan(arcilla);
  });

  it('el canal humedece vecinas de forma decreciente con la distancia', () => {
    const tiles = service.execute('canal', '2:2', grid(), ctx()).tiles;
    const h = (id: string) => tiles.find((t) => t.id === id)!.humedad;
    expect(h('2:2')).toBe(100);
    expect(h('3:2')).toBeGreaterThan(h('4:2'));
    expect(h('4:2')).toBeGreaterThan(40);
    expect(h('0:0')).toBeGreaterThan(40);
  });
});
