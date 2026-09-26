/**
 * Parte visual del cielo: los tokens cubren todos los estados del dominio, el color que se
 * pinta es exactamente el del token (el fondo no pasa por el mapeo tonal del renderer) y
 * la niebla tiñe la parcela midiendo desde la cámara, no desde la parcela.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EstadoCieloVisual } from '@/domain/climate';
import { cielo } from '@/theme/tokens';
import { avanzarColor, rangosNiebla } from './skyVisual';

const HEX = /^#[0-9A-F]{6}$/;

describe('tokens.cielo', () => {
  it('cubre todos los estados del dominio, ni uno más ni uno menos', () => {
    const estados: EstadoCieloVisual[] = [
      'despejado',
      'calor',
      'nublado',
      'niebla',
      'lluvia',
      'lluvia-fuerte',
      'helada',
    ];
    expect(estados.filter((e) => !cielo[e])).toEqual([]);
    expect(Object.keys(cielo).sort()).toEqual([...estados].sort());
  });

  it('tiene color válido para los dos temas y una luz con sentido', () => {
    for (const [estado, t] of Object.entries(cielo)) {
      expect(t.claro, `${estado}.claro`).toMatch(HEX);
      expect(t.oscuro, `${estado}.oscuro`).toMatch(HEX);
      expect(t.luz, `${estado}.luz`).toBeGreaterThan(0);
      expect(t.luz, `${estado}.luz`).toBeLessThanOrEqual(1.2);
    }
  });

  it('el color que se pinta es el del token (ida y vuelta sRGB)', () => {
    for (const t of Object.values(cielo)) {
      for (const hex of [t.claro, t.oscuro]) {
        expect(`#${new THREE.Color(hex).getHexString()}`).toBe(hex.toLowerCase());
      }
    }
  });
});

describe('rangosNiebla', () => {
  it('la niebla empieza antes de la parcela para que el tinte se vea', () => {
    // La cámara del God-View está a 0.9·diagonal y la esquina lejana a ~1.4·diagonal.
    const { near, far } = rangosNiebla(0.9 * 10);
    expect(near).toBeLessThan(0.9 * 10);
    expect(near).toBeLessThan(1.4 * 10);
    expect(far).toBeGreaterThan(1.4 * 10);
  });

  it('escala con la cámara (al acercar, la niebla no aplana el detalle)', () => {
    const lejos = rangosNiebla(40);
    const cerca = rangosNiebla(4);
    expect(cerca.near / cerca.far).toBe(lejos.near / lejos.far);
    expect(cerca.far).toBeLessThan(lejos.far);
  });

  it('nunca degenera el rango', () => {
    const { near, far } = rangosNiebla(0);
    expect(far).toBeGreaterThan(near);
  });
});

describe('avanzarColor', () => {
  const destino = new THREE.Color('#000000');
  const blanco = new THREE.Color('#FFFFFF');

  it('acerca el color actual al destino sin saltar de golpe', () => {
    const actual = new THREE.Color(blanco);
    const primerPaso = actual.r;

    expect(avanzarColor(actual, destino, 0.016)).toBe(true);
    expect(actual.r).toBeLessThan(primerPaso);
    expect(actual.r).toBeGreaterThan(destino.r);
  });

  it('con delta grande no completa la transición de un solo paso', () => {
    const actual = new THREE.Color(blanco);
    avanzarColor(actual, destino, 30);
    expect(actual.r).toBeGreaterThan(destino.r);
  });

  it('deja de repintar cuando ya llegó al destino', () => {
    const actual = new THREE.Color(destino);
    expect(avanzarColor(actual, destino, 0.016)).toBe(false);
  });
});
