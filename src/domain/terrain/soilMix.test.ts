/** La mezcla es la variable de la parcela: normaliza, ordena y se edita sin mutar. */
import { describe, expect, it } from 'vitest';
import type { MezclaSuelos } from '@/data/types';
import { SoilMix, TOTAL_PORCENTAJE, normalizarPorcentajes } from './soilMix';

const datos = (porcentajes: Record<string, number>): MezclaSuelos => ({
  id: 'prueba',
  nombre: 'Mezcla de prueba',
  descripcion: 'Reparto para tests',
  porcentajes,
});

describe('normalizarPorcentajes', () => {
  it('convierte pesos en porcentajes que suman 100', () => {
    expect(normalizarPorcentajes({ Franco: 30, Arena: 10 })).toEqual({ Franco: 75, Arena: 25 });
  });

  it('descarta los 0 % y la mezcla sin pesos queda vacía', () => {
    expect(normalizarPorcentajes({ Franco: 3, Arena: 0 })).toEqual({ Franco: TOTAL_PORCENTAJE });
    expect(normalizarPorcentajes({ Franco: 0, Arena: 0 })).toEqual({});
  });
});

describe('SoilMix', () => {
  it('expone las clases de mayor a menor porcentaje y la dominante', () => {
    const mezcla = SoilMix.de(datos({ Arena: 20, Franco: 50, Limo: 30 }));
    expect(mezcla.partes()).toEqual([
      { clase: 'Franco', porcentaje: 50 },
      { clase: 'Limo', porcentaje: 30 },
      { clase: 'Arena', porcentaje: 20 },
    ]);
    expect(mezcla.dominante).toBe('Franco');
    expect(mezcla.porcentajeDominante).toBe(50);
    expect(mezcla.porcentajeDe('Limo')).toBe(30);
    expect(mezcla.porcentajeDe('Arcilla')).toBe(0);
  });

  it('deriva la textura de la clase dominante', () => {
    expect(SoilMix.de(datos({ 'Franco arcilloso': 40, Arena: 60 })).textura).toBe('ligera');
    expect(SoilMix.de(datos({ 'Franco arcilloso': 60, Arena: 40 })).textura).toBe('pesada');
  });

  it('conPorcentaje fija ese % exacto y reparte el resto proporcionalmente', () => {
    const mezcla = SoilMix.de(datos({ Franco: 50, Arena: 30, Limo: 20 }));
    const editado = mezcla.conPorcentaje('Arena', 60);
    expect(editado.porcentajeDe('Arena')).toBe(60);
    // Franco:Limo es 50:20, así que sobre el 40 % restante les toca 28,6 % y 11,4 %.
    expect(editado.porcentajeDe('Franco')).toBeCloseTo(28.6, 1);
    expect(editado.porcentajeDe('Limo')).toBeCloseTo(11.4, 1);
    expect(editado.dominante).toBe('Arena');
  });

  it('no muta la mezcla original y no deja la parcela sin suelo', () => {
    const original = SoilMix.de(datos({ Franco: 100 }));
    expect(original.conPorcentaje('Franco', 0).porcentajeDe('Franco')).toBe(TOTAL_PORCENTAJE);
    expect(original.porcentajeDe('Franco')).toBe(TOTAL_PORCENTAJE);
  });
});
