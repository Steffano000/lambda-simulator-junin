import { describe, expect, it } from 'vitest';
import { ClimateRepository, CropRepository } from '@/data';
import { ClimateScenarioFactory } from '../climate';
import { SimulationClock } from '../simulation';
import { CropFactory } from './CropFactory';

const crops = new CropFactory(CropRepository.all());

describe('Crop', () => {
  const papa = crops.create('Papa');

  it('avanza Siembra → Germinación → Desarrollo → Media → Final (docs/04)', () => {
    const d = papa.datos;
    expect(papa.etapaEn(0)).toBe('siembra');
    expect(papa.etapaEn(1)).toBe('germinacion');
    expect(papa.etapaEn(d.dias_inicial)).toBe('desarrollo');
    expect(papa.etapaEn(d.dias_inicial + d.dias_desarrollo)).toBe('media');
    expect(papa.etapaEn(papa.inicioFinal)).toBe('final');
    expect(papa.etapaEn(d.ciclo_dias)).toBe('cosecha');
  });

  it('las etapas suman el ciclo total en todos los cultivos', () => {
    for (const c of crops.all()) {
      const d = c.datos;
      expect(d.dias_inicial + d.dias_desarrollo + d.dias_media + d.dias_final).toBe(d.ciclo_dias);
    }
  });

  it('CropFactory rechaza cultivos desconocidos', () => {
    expect(() => crops.create('Tomate')).toThrow(/desconocido/);
  });
});

describe('ClimateScenarioFactory', () => {
  const fuente = Object.fromEntries(
    ClimateRepository.scenarioNames().map((n) => [n, [...ClimateRepository.byName(n)!]]),
  );
  const factory = new ClimateScenarioFactory(fuente);

  it('crea los 5 escenarios reales con 12 meses', () => {
    expect(factory.all()).toHaveLength(5);
    for (const e of factory.all()) expect(e.meses).toHaveLength(12);
  });

  it('el extremo seco llueve menos que el lluvioso', () => {
    const seco = factory.create('Extremo seco 1991-92');
    const lluvioso = factory.create('Lluvioso / La Niña 1988-89');
    expect(seco.lluviaAnual).toBeLessThan(lluvioso.lluviaAnual);
  });

  it('rechaza un escenario personalizado incompleto', () => {
    expect(() => factory.custom('Mío', fuente['Normal 2001-02'].slice(0, 11))).toThrow(/Falta el mes 12/);
  });
});

describe('SimulationClock', () => {
  it('calcula el mes calendario con meses de 365/12 días', () => {
    expect(SimulationClock.mesActual(10, 0)).toBe(10);
    expect(SimulationClock.mesActual(10, 31)).toBe(11);
    expect(SimulationClock.mesActual(12, 31)).toBe(1);
  });
});
