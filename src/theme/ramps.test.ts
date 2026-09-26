import { describe, expect, it } from 'vitest';
import { SoilRepository } from '@/data';
import { chiColor, humidityColor, sampleRamp, soilColor, soilSlug } from './ramps';
import { chi, humedad, soil, surface } from './tokens';

describe('ramps', () => {
  it('devuelve los extremos exactos de la rampa', () => {
    expect(humidityColor(0)).toBe(humedad[0]);
    expect(humidityColor(100)).toBe(humedad[100]);
    expect(chiColor(0)).toBe(chi[0]);
  });

  it('acota valores fuera de rango', () => {
    expect(humidityColor(-20)).toBe(humedad[0]);
    expect(humidityColor(150)).toBe(humedad[100]);
  });

  it('interpola en el punto medio', () => {
    expect(sampleRamp({ 0: '#000000', 10: '#FFFFFF' }, 5)).toBe('#808080');
  });

  it('toda clase de data/terrenos.json tiene color de suelo propio', () => {
    for (const t of SoilRepository.all()) {
      expect(soil).toHaveProperty(soilSlug(t.clase));
      expect(soilColor(t.clase)).not.toBe(surface.vacio);
    }
  });
});
