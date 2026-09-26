import { describe, expect, it } from 'vitest';
import { ClimateRepository, SoilRepository } from '@/data';
import { ClimateScenario, DIAS_POR_MES, WeatherGenerator } from '../climate';
import { ALMACEN_SUPERFICIE, SoilHydraulics } from './SoilHydraulics';
import { estadoHidrico } from './HydrationState';
import { WaterBalance, type Suelo } from './WaterBalance';

const props = (clase: string) => SoilHydraulics.of(SoilRepository.byClass(clase)!);
const suelo = (clase: string, conSurcos = false): Suelo => ({
  props: props(clase),
  capacidadMm: SoilHydraulics.capacidadMm(props(clase), 0.3),
  conSurcos,
});

describe('SoilHydraulics · variables hídricas por terreno', () => {
  it('la arena absorbe y drena más rápido que la arcilla; la arcilla retiene más', () => {
    const arena = props('Arena');
    const arcilla = props('Arcilla');
    expect(arena.absorcionMmH).toBeGreaterThan(arcilla.absorcionMmH);
    expect(arena.drenajeDia).toBeGreaterThan(arcilla.drenajeDia);
    expect(arcilla.retencionMmM).toBeGreaterThan(arena.retencionMmM);
  });

  it('lee REW/TEW de terrenos.json y usa la textura si faltan', () => {
    expect(props('Franco').rewMm).toBe(9);
    expect(props('Franco arcilloso').tewMm).toBeGreaterThan(0);
  });
});

describe('WaterBalance · lluvia y riego con el mismo sistema', () => {
  it('una lluvia intensa en arcilla deja agua en superficie; en arena se absorbe', () => {
    const inicio = { humedad: 50, aguaSuperficie: 0 };
    const arena = WaterBalance.aplicar(inicio, 30, 1.5, suelo('Arena'));
    const arcilla = WaterBalance.aplicar(inicio, 30, 1.5, suelo('Arcilla'));
    expect(arena.almacenado + arena.escorrentia).toBe(0);
    expect(arcilla.almacenado + arcilla.escorrentia).toBeGreaterThan(20);
  });

  it('los surcos guardan el agua que en terreno plano escurre', () => {
    const inicio = { humedad: 60, aguaSuperficie: 0 };
    const plano = WaterBalance.aplicar(inicio, 40, 2, suelo('Arcilla'));
    const surcos = WaterBalance.aplicar(inicio, 40, 2, suelo('Arcilla', true));
    expect(plano.almacenado).toBeLessThanOrEqual(ALMACEN_SUPERFICIE.plano);
    expect(surcos.almacenado).toBeGreaterThan(plano.almacenado);
    expect(surcos.escorrentia).toBeLessThan(plano.escorrentia);
  });

  it('el agua de los surcos se incorpora al suelo con los días', () => {
    const s = suelo('Franco', true);
    const dia = WaterBalance.dia({ humedad: 40, aguaSuperficie: 30 }, 3.5, s);
    expect(dia.infiltrado).toBeGreaterThan(0);
    expect(dia.estado.aguaSuperficie).toBeLessThan(30);
    expect(dia.estado.humedad).toBeGreaterThan(40);
  });

  it('el agua gravitacional drena: más rápido en arena que en arcilla', () => {
    const arena = WaterBalance.dia({ humedad: 180, aguaSuperficie: 0 }, 0, suelo('Arena'));
    const arcilla = WaterBalance.dia({ humedad: 180, aguaSuperficie: 0 }, 0, suelo('Arcilla'));
    expect(180 - arena.estado.humedad).toBeGreaterThan(180 - arcilla.estado.humedad);
  });
});

describe('Estados de hidratación', () => {
  const sat = props('Arcilla').saturacionPct;
  it('clasifica de seco a encharcado', () => {
    expect(estadoHidrico(10, 0, sat)).toBe('seco');
    expect(estadoHidrico(35, 0, sat)).toBe('baja');
    expect(estadoHidrico(70, 0, sat)).toBe('adecuada');
    expect(estadoHidrico(95, 0, sat)).toBe('alta');
    expect(estadoHidrico(130, 0, sat)).toBe('saturado');
    expect(estadoHidrico(sat, 10, sat)).toBe('encharcado');
  });

  it('surcos con agua sobre suelo no saturado todavía no es encharcamiento', () => {
    expect(estadoHidrico(60, 20, sat)).not.toBe('encharcado');
  });
});

describe('WeatherGenerator · validación meteorológica', () => {
  const normal = new ClimateScenario('Normal 2001-02', ClimateRepository.byName('Normal 2001-02')!);

  it('es determinista por semilla y día', () => {
    expect(WeatherGenerator.generar(normal, 10, 5, 42)).toEqual(WeatherGenerator.generar(normal, 10, 5, 42));
  });

  it('en muchos años reproduce la lluvia mensual del escenario (±15 %)', () => {
    const años = 40;
    const dias = Math.floor(365 * años);
    let total = 0;
    for (let d = 0; d < dias; d++) total += WeatherGenerator.generar(normal, 1, d, 7).lluvia?.mm ?? 0;
    const esperado = normal.lluviaAnual * (dias / 365);
    expect(Math.abs(total - esperado) / esperado).toBeLessThan(0.15);
  });

  it('llueve más días en la época de lluvias (feb) que en la seca (jul)', () => {
    const diasConLluvia = (mes: number) => {
      let n = 0;
      for (let k = 0; k < 400; k++) {
        const dia = Math.floor((mes - 1) * DIAS_POR_MES) + (k % 28) + 365 * Math.floor(k / 28);
        if (WeatherGenerator.generar(normal, 1, dia, 3).lluvia) n++;
      }
      return n;
    };
    expect(diasConLluvia(2)).toBeGreaterThan(diasConLluvia(7));
  });

  it('un día de lluvia trae nubes, intensidad y duración coherentes', () => {
    for (let d = 0; d < 200; d++) {
      const hoy = WeatherGenerator.generar(normal, 1, d, 11);
      if (!hoy.lluvia) continue;
      expect(hoy.nubes).toBe(true);
      expect(hoy.cielo).toBe('lluvia');
      // duración = cantidad / intensidad (ambas redondeadas a 0.1: tolerancia de ±0.1 h)
      const esperada = Math.min(24, Math.max(0.5, hoy.lluvia.mm / hoy.lluvia.intensidadMmH));
      expect(Math.abs(hoy.lluvia.duracionH - esperada)).toBeLessThanOrEqual(0.1);
    }
  });
});
