import { describe, expect, it } from 'vitest';
import { CropRepository } from '@/data';
import type { Cosecha } from '../actions';
import { CropFactory, EXTRACCION_N, RECUPERACION_DESCANSO } from '../crops';
import { createGrid, GridConfigBuilder, type TileNode } from '../grid';
import { SimulationClock } from '../simulation';
import { FallowAdvisor } from './FallowAdvisor';
import { HarvestReport } from './HarvestReport';
import { CONSUMO_POR_ACCION, economiaDe } from './insumos';
import { registrosDelCiclo, type RegistroAccion } from './ledger';

const crops = new CropFactory(CropRepository.all());
const papa = crops.create('Papa');
const celdas = ['0:0', '1:0'];

const bitacora: RegistroAccion[] = [
  // Ciclo anterior (cerrado por la cosecha del día 5): no debe contarse
  { dia: 0, tool: 'arar', tileIds: celdas },
  { dia: 5, tool: 'cosechar', tileIds: celdas, cultivo: 'Papa' },
  // Ciclo actual
  { dia: 6, tool: 'arar', tileIds: celdas },
  { dia: 6, tool: 'encalar', tileIds: ['0:0'] },
  { dia: 7, tool: 'abonar-organico', tileIds: celdas },
  { dia: 7, tool: 'abonar-organico', tileIds: [...celdas, '9:9'] },
  { dia: 8, tool: 'regar', tileIds: celdas },
  { dia: 8, tool: 'inundar', tileIds: celdas },
  { dia: 10, tool: 'sembrar', tileIds: celdas, cultivo: 'Papa' },
  { dia: 130, tool: 'cosechar', tileIds: celdas, cultivo: 'Papa' },
];

const cosechas: Cosecha[] = celdas.map((tileId) => ({
  tileId,
  cultivo: 'Papa',
  dia: 130,
  salud: 80,
  kg: 1.74,
}));
const tiles = (n: number): TileNode[] =>
  createGrid(new GridConfigBuilder().size(3, 3).build(), ['Franco'])
    .filter((t) => celdas.includes(t.id))
    .map((t) => ({ ...t, suelo: { ...t.suelo, n } }));

const reporte = () =>
  HarvestReport.generar({
    id: 'R1',
    plantacion: { id: 'P1', diaSiembra: 10 },
    crop: papa,
    cosechas,
    diaCosecha: 130,
    bitacora,
    tilesDespues: tiles(20),
    candidatos: crops.all(),
  });

describe('Bitácora · ciclo de la celda', () => {
  it('solo cuenta las acciones desde el cierre del ciclo anterior', () => {
    const ciclo = registrosDelCiclo(bitacora, new Set(celdas), 10);
    expect(ciclo[0]).toMatchObject({ dia: 6, tool: 'arar' });
    expect(ciclo.some((r) => r.dia === 0)).toBe(false);
  });
});

describe('HarvestReport · resumen de la recolección', () => {
  it('cuenta veces y aplicaciones celda a celda de cada acción en el área cosechada', () => {
    const r = reporte();
    const abono = r.acciones.find((a) => a.tool === 'abonar-organico')!;
    expect(abono).toMatchObject({ veces: 2, aplicaciones: 4 }); // la celda 9:9 no es del área
    expect(r.acciones.find((a) => a.tool === 'encalar')).toMatchObject({ veces: 1, aplicaciones: 1 });
    expect(r.areaM2).toBe(2);
  });

  it('suma insumos: abono, cal, semilla y el agua como tiempo de riego', () => {
    const r = reporte();
    const kg = (id: string) => r.insumos.find((f) => f.insumo === id)?.cantidad;
    expect(kg('abono-organico')).toBe(CONSUMO_POR_ACCION['abonar-organico'][0].cantidad * 4);
    expect(kg('cal')).toBe(0.3);
    expect(kg('semilla')).toBeCloseTo(economiaDe('Papa').semillaKgM2 * 2, 5);
    expect(r.riego).toMatchObject({ eventos: 2, horas: 5, litros: (20 + 50) * 2 });
  });

  it('balance = venta − gasto, con tiempos del ciclo', () => {
    const r = reporte();
    expect(r.produccionKg).toBe(3.48);
    expect(r.ingreso).toBeCloseTo(3.48 * economiaDe('Papa').precioVenta, 2);
    expect(r.balance).toBeCloseTo(r.ingreso - r.costoTotal, 2);
    expect(r.diaInicio).toBe(6);
    expect(r.rendimientoTHa).toBeCloseTo(17.4, 1);
  });
});

describe('FallowAdvisor · descanso o rotación', () => {
  it('la papa (alta demanda) pide descanso y sugiere rotar a la haba (fija N)', () => {
    const reco = FallowAdvisor.recomendar(papa, 20, crops.all());
    expect(reco.diasDescanso).toBeGreaterThan(0);
    expect(reco.alternativas[0].cultivo).toBe('Haba (grano seco)');
    expect(reco.alternativas.every((a) => a.cultivo !== 'Papa')).toBe(true);
  });

  it('una leguminosa no necesita descanso', () => {
    expect(FallowAdvisor.recomendar(crops.create('Haba (grano seco)'), 40, crops.all()).diasDescanso).toBe(0);
  });
});

describe('Nutrientes · extracción y barbecho', () => {
  it('la cosecha de papa extrae más N que la de haba (que lo aporta)', () => {
    expect(EXTRACCION_N.alta).toBeGreaterThan(EXTRACCION_N.media);
    expect(EXTRACCION_N.fija).toBeLessThan(0);
  });

  it('el suelo en descanso recupera N cada día y se libera al terminar', () => {
    const t: TileNode = { ...tiles(20)[0], descansoHasta: 3 };
    SimulationClock.descansar(t, 0);
    SimulationClock.descansar(t, 1);
    SimulationClock.descansar(t, 2);
    expect(t.suelo.n).toBeCloseTo(20 + 3 * RECUPERACION_DESCANSO.nPorDia, 5);
    SimulationClock.descansar(t, 3);
    expect(t.descansoHasta).toBeNull();
  });
});

describe('HarvestReport · parcela real con celdas de 2 m', () => {
  it('el área, los insumos y el rendimiento usan los m² reales, no el número de celdas', () => {
    const base = reporte();
    const r = HarvestReport.generar({
      id: 'R2',
      plantacion: { id: 'P1', diaSiembra: 10 },
      crop: papa,
      cosechas: cosechas.map((c) => ({ ...c, kg: c.kg * 4 })),
      diaCosecha: 130,
      bitacora,
      tilesDespues: tiles(20),
      candidatos: crops.all(),
      areaDe: () => 4,
    });
    expect(r.nCeldas).toBe(2);
    expect(r.areaM2).toBe(8);
    expect(r.produccionKg).toBeCloseTo(base.produccionKg * 4, 2);
    expect(r.rendimientoTHa).toBe(base.rendimientoTHa); // t/ha no cambia
    expect(r.costoTotal).toBeCloseTo(base.costoTotal * 4, 1);
    // referencia = kg / salud / área: 1.74 / 0.8 kg/m² = 21.75 t/ha
    expect(r.referenciaTHa).toBeCloseTo(21.75, 1);
  });
});
