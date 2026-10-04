import { describe, expect, it } from 'vitest';
import { coberturaDia, fondoNubes, margenNubes, planNubes } from './cloudPlan';

describe('Fase 4 · nubes que nunca tocan el terreno', () => {
  it('la nube más baja queda por encima del techo del terreno + margen, con cualquier relieve', () => {
    for (const [rows, cols, techo] of [
      [10, 10, 1],
      [100, 100, 75], // parcela real con relieve ×3
      [37, 91, 240],
      [3, 3, 0],
    ] as const) {
      for (let seed = 1; seed < 40; seed++) {
        const p = planNubes({ rows, cols, techo, cobertura: 1, seed });
        expect(p.base).toBeCloseTo(techo + margenNubes(rows, cols), 6);
        expect(fondoNubes(p)).toBeGreaterThanOrEqual(p.base - 1e-9);
        expect(fondoNubes(p)).toBeGreaterThan(techo);
      }
    }
  });

  it('misma semilla, mismas nubes; otra semilla, otras', () => {
    const a = planNubes({ rows: 50, cols: 50, techo: 10, cobertura: 0.7, seed: 7 });
    const b = planNubes({ rows: 50, cols: 50, techo: 10, cobertura: 0.7, seed: 7 });
    const c = planNubes({ rows: 50, cols: 50, techo: 10, cobertura: 0.7, seed: 8 });
    expect(a).toEqual(b);
    expect(a.puffs[0]).not.toEqual(c.puffs[0]);
  });

  it('más cobertura, más nubes; sin nubes en un día despejado', () => {
    const poco = planNubes({ rows: 80, cols: 80, techo: 0, cobertura: 0.25, seed: 3 });
    const mucho = planNubes({ rows: 80, cols: 80, techo: 0, cobertura: 1, seed: 3 });
    expect(mucho.nubes.length).toBeGreaterThan(poco.nubes.length);
    expect(planNubes({ rows: 80, cols: 80, techo: 0, cobertura: 0, seed: 3 }).puffs).toHaveLength(0);
    expect(coberturaDia(false, 0.5, null)).toBe(0);
    expect(coberturaDia(true, 0.5, null)).toBeCloseTo(0.5);
    expect(coberturaDia(true, 0.9, 'fuerte')).toBe(1);
  });

  it('el tamaño de las nubes escala con la grilla', () => {
    const chica = planNubes({ rows: 10, cols: 10, techo: 0, cobertura: 1, seed: 5 });
    const grande = planNubes({ rows: 100, cols: 100, techo: 0, cobertura: 1, seed: 5 });
    const radio = (p: typeof chica) => Math.max(...p.nubes.map((n) => n.r));
    expect(radio(grande)).toBeGreaterThan(radio(chica));
  });
});
