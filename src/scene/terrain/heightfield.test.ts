import { describe, expect, it } from 'vitest';
import {
  alturaEn,
  areaPoligono,
  construirHeightfield,
  pendienteCelda,
  recortarCuadrado,
} from './heightfield';

const grilla = (rows: number, cols: number, f: (r: number, c: number) => number | null) =>
  Array.from({ length: rows * cols }, (_, i) => f(Math.floor(i / cols), i % cols));

describe('Fase 5 · superficie continua', () => {
  it('un terreno plano queda plano (con y sin suavizado) y su pendiente es 0', () => {
    for (const s of [0, 1, 3]) {
      const hf = construirHeightfield(
        6,
        8,
        grilla(6, 8, () => 5),
        s,
      );
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 8; c++) {
          expect(alturaEn(hf, c + 0.3, r + 0.7)).toBeCloseTo(5, 9);
          expect(pendienteCelda(hf, r, c, 3)).toBeCloseTo(0, 9);
        }
    }
  });

  it('una rampa da la misma pendiente en todo el interior, también suavizada', () => {
    // sube 0.3 u por celda con exageración 3 → tan θ = 0.1 → 5.71°
    for (const s of [0, 2]) {
      const hf = construirHeightfield(
        10,
        10,
        grilla(10, 10, (_, c) => c * 0.3),
        s,
      );
      const esperado = (Math.atan(0.1) * 180) / Math.PI;
      for (let r = 1; r < 9; r++)
        for (let c = 1; c < 9; c++) expect(pendienteCelda(hf, r, c, 3)).toBeCloseTo(esperado, 6);
    }
  });

  it('es continua: no hay escalón entre celdas vecinas', () => {
    const hf = construirHeightfield(
      4,
      4,
      grilla(4, 4, (r, c) => ((r + c) % 2 ? 2 : 0)),
      0,
    );
    expect(alturaEn(hf, 0.9999, 1.5)).toBeCloseTo(alturaEn(hf, 1.0001, 1.5), 3);
  });

  it('las celdas fuera de la parcela no generan vértices', () => {
    const hf = construirHeightfield(
      3,
      3,
      grilla(3, 3, (r, c) => (r === 0 && c === 0 ? 1 : null)),
      1,
    );
    expect(hf.v[1 * 4 + 1]).toBe(1); // esquina de la celda (0,0)
    expect(Number.isNaN(hf.v[2 * 4 + 2])).toBe(true); // lejos de toda celda
    expect(hf.v.filter((x) => !Number.isNaN(x)).length).toBe(4);
  });

  it('el borde de la parcela recorta la celda (área exacta)', () => {
    const triangulo: [number, number][] = [
      [0, 0],
      [2, 0],
      [0, 2],
    ];
    const parte = recortarCuadrado(triangulo, 0, 0, 1, 1);
    expect(areaPoligono(parte)).toBeCloseTo(1, 9); // la diagonal x+z=2 pasa por la esquina
    expect(areaPoligono(recortarCuadrado(triangulo, 1, 0, 2, 1))).toBeCloseTo(0.5, 9);
    expect(recortarCuadrado(triangulo, 5, 5, 6, 6)).toHaveLength(0);
  });
});
