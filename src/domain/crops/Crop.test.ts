import { describe, expect, it } from 'vitest';
import { ClimateRepository, CropRepository } from '@/data';
import { ClimateScenarioFactory } from '../climate';
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

describe('Crop · curva Kc, textura y datos faltantes', () => {
  const papa = crops.create('Papa');

  it('Kc FAO-56: inicial → rampa → medio → rampa a final', () => {
    const d = papa.datos;
    expect(papa.kc(0)).toBe(d.kc_inicial);
    expect(papa.kc(d.dias_inicial + d.dias_desarrollo / 2)).toBeCloseTo((d.kc_inicial + d.kc_medio) / 2, 5);
    expect(papa.kc(papa.inicioFinal)).toBe(d.kc_medio);
    expect(papa.kc(d.ciclo_dias)).toBeCloseTo(d.kc_final, 5);
  });

  it('compatibilidad de textura según textura_preferida', () => {
    expect(papa.texturaCompatible('media')).toBe(true);
    expect(papa.texturaCompatible('pesada')).toBe(false);
    // "sin dato" acepta cualquier textura
    expect(crops.create('Maíz amiláceo').texturaCompatible('pesada')).toBe(true);
  });

  it('sin t_base ni helada_letal (Haba) no se inventa un bloqueo climático', () => {
    const haba = crops.create('Haba (grano seco)');
    expect(haba.motivosClima({ mes: 7, nombre: 'Jul', et0: 75, lluvia: 28, tmed: 7.5, tmin: -5 })).toEqual(
      [],
    );
  });

  it('el umbral de humedad sale de p_agotamiento (Papa p=0.35 → 65 %)', () => {
    expect(papa.umbralHumedad).toBe(65);
  });
});
