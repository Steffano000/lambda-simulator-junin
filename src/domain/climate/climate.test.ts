import { describe, expect, it } from 'vitest';
import { ClimateRepository, CropRepository } from '@/data';
import type { ClimaEscenarios } from '@/data/types';
import { CropFactory } from '../crops';
import { CycleBalance } from '../simulation';
import { ClimateScenarioFactory } from './ClimateScenarioFactory';
import { ScenarioBuilder } from './ScenarioBuilder';
import { ScenarioCodec } from './ScenarioCodec';

const fuente: ClimaEscenarios = Object.fromEntries(
  ClimateRepository.scenarioNames().map((n) => [n, [...ClimateRepository.byName(n)!]]),
);
const nuevaFactory = () => new ClimateScenarioFactory(fuente);
const crops = new CropFactory(CropRepository.all());

describe('ScenarioBuilder', () => {
  const normal = nuevaFactory().create('Normal 2001-02');

  it('sin modificadores reproduce la base', () => {
    expect(ScenarioBuilder.from(normal).build()).toEqual(normal.ordenados);
  });

  it('aplica lluvia ×%, ET0 ×% y +Δ °C a los 12 meses', () => {
    const meses = ScenarioBuilder.from(normal)
      .withModificadores({ lluviaPct: 50, et0Pct: 110, deltaT: 2 })
      .build();
    const ene = normal.mes(1);
    expect(meses[0].lluvia).toBeCloseTo(ene.lluvia * 0.5, 1);
    expect(meses[0].et0).toBeCloseTo(ene.et0 * 1.1, 1);
    expect(meses[0].tmed).toBeCloseTo(ene.tmed + 2, 1);
    expect(meses[0].tmin).toBeCloseTo(ene.tmin + 2, 1);
  });

  it('las ediciones por mes tienen prioridad sobre los modificadores', () => {
    const meses = ScenarioBuilder.from(normal)
      .withModificadores({ lluviaPct: 200 })
      .withEdiciones({ 3: { lluvia: 0 } })
      .build();
    expect(meses[2].lluvia).toBe(0);
    expect(meses[3].lluvia).toBeCloseTo(normal.mes(4).lluvia * 2, 1);
  });
});

describe('ClimateScenarioFactory · personalizados', () => {
  it('registra, lista, reemplaza y elimina un personalizado', () => {
    const f = nuevaFactory();
    const meses = ScenarioBuilder.from(f.create('Normal 2001-02'))
      .withModificadores({ lluviaPct: 80 })
      .build();
    f.custom('Sequía moderada', meses, 'Normal 2001-02');
    expect(f.nombres()).toContain('Sequía moderada');
    expect(f.create('Sequía moderada').base).toBe('Normal 2001-02');

    f.custom('Sequía moderada', ScenarioBuilder.from(f.create('Normal 2001-02')).build());
    expect(f.create('Sequía moderada').lluviaAnual).toBeCloseTo(f.create('Normal 2001-02').lluviaAnual, 0);

    expect(f.remove('Sequía moderada')).toBe(true);
    expect(f.existe('Sequía moderada')).toBe(false);
  });

  it('no permite usar el nombre de un escenario real', () => {
    const f = nuevaFactory();
    expect(() => f.custom('Normal 2001-02', f.create('Normal 2001-02').ordenados)).toThrow(/escenario real/);
  });

  it('rechaza valores fuera de rango y tmin > tmed', () => {
    const base = nuevaFactory().create('Normal 2001-02').ordenados;
    const malos = base.map((m, i) => (i === 0 ? { ...m, lluvia: -5, tmin: m.tmed + 1 } : m));
    const errores = ClimateScenarioFactory.validar(malos);
    expect(errores.some((e) => e.includes('fuera de rango'))).toBe(true);
    expect(errores.some((e) => e.includes('tmin no puede superar tmed'))).toBe(true);
  });
});

describe('ScenarioCodec', () => {
  it('exporta e importa sin pérdida (formato clima_escenarios)', () => {
    const f = nuevaFactory();
    const json = ScenarioCodec.stringify([f.create('Seco / El Niño 2015-16')]);
    const [imp] = ScenarioCodec.parse(json);
    expect(imp.nombre).toBe('Seco / El Niño 2015-16');
    expect(imp.errores).toEqual([]);
    expect(imp.meses).toEqual(f.create('Seco / El Niño 2015-16').ordenados);
  });

  it('acepta una lista suelta de 12 meses y reporta JSON inválido sin lanzar', () => {
    const lista = JSON.stringify(nuevaFactory().create('Normal 2001-02').ordenados);
    expect(ScenarioCodec.parse(lista, 'Mío')[0]).toMatchObject({ nombre: 'Mío', errores: [] });
    expect(ScenarioCodec.parse('{ no es json')[0].errores[0]).toMatch(/JSON inválido/);
  });
});

describe('CycleBalance · comparativa cultivo × escenario', () => {
  const f = nuevaFactory();
  const papa = crops.create('Papa');

  it('Papa en año lluvioso tiene mejor balance que en extremo seco', () => {
    const seco = CycleBalance.calcular(papa, f.create('Extremo seco 1991-92'));
    const lluvioso = CycleBalance.calcular(papa, f.create('Lluvioso / La Niña 1988-89'));
    expect(lluvioso.balance).toBeGreaterThan(seco.balance);
    expect(lluvioso.balance).toBeGreaterThan(0);
    expect(seco.balance).toBeLessThan(0);
  });

  // Totales del ciclo de Papa publicados en docs/spec.md (derivación mensual de referencia)
  const SPEC_PAPA: Record<string, { etc: number; lluvia: number }> = {
    'Promedio 1950–2026': { etc: 381.823, lluvia: 347.595 },
    'Normal 2001-02': { etc: 400.431, lluvia: 302.284 },
    'Seco / El Niño 2015-16': { etc: 407.495, lluvia: 300.547 },
    'Lluvioso / La Niña 1988-89': { etc: 364.113, lluvia: 397.2 },
    'Extremo seco 1991-92': { etc: 403.118, lluvia: 242.032 },
  };

  it.each(Object.entries(SPEC_PAPA))('coincide con spec.md (±1.5 %) · Papa · %s', (escenario, ref) => {
    const r = CycleBalance.calcular(papa, f.create(escenario));
    expect(Math.abs(r.etc - ref.etc) / ref.etc).toBeLessThan(0.015);
    expect(Math.abs(r.lluvia - ref.lluvia) / ref.lluvia).toBeLessThan(0.015);
  });
});
