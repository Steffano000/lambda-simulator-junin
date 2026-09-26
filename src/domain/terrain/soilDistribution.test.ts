/** El reparto por la grilla: respeta los %, es determinista y genera manchas. */
import { describe, expect, it } from 'vitest';
import { GridConfigBuilder, type SizePreset } from '../grid';
import { SoilMix } from './soilMix';
import { POR_ALEATORIO, POR_MANCHAS, celdasAisladas, repartirSuelos, repartoReal } from './soilDistribution';
import type { MezclaSuelos } from '@/data/types';

const config = (tamano: SizePreset = 'parcela', seed = 7) =>
  new GridConfigBuilder().preset(tamano).seed(seed).build();

const mezcla = (porcentajes: Record<string, number>) =>
  SoilMix.de({ id: 'prueba', nombre: 'Prueba', descripcion: '', porcentajes } satisfies MezclaSuelos);

/** Margen por clase: pequeño en valor absoluto y relativo al peso pedido. */
const cerca = (real: number, objetivo: number) => expect(Math.abs(real - objetivo)).toBeLessThan(3);

describe('repartirSuelos', () => {
  it('devuelve una clase por celda, en orden z * cols + x', () => {
    const cfg = config('demo');
    const reparto = repartirSuelos(mezcla({ Franco: 60, Arena: 40 }), cfg);
    expect(reparto).toHaveLength(cfg.rows * cfg.cols);
    expect(new Set(reparto)).toEqual(new Set(['Franco', 'Arena']));
  });

  it('es determinista: misma mezcla y semilla, mismo mapa', () => {
    const m = mezcla({ Franco: 70, Limo: 20, Arena: 10 });
    expect(repartirSuelos(m, config())).toEqual(repartirSuelos(m, config()));
  });

  it('cambia el mapa al cambiar la semilla', () => {
    const m = mezcla({ Franco: 50, Arena: 50 });
    expect(repartirSuelos(m, config('demo', 1))).not.toEqual(repartirSuelos(m, config('demo', 2)));
  });

  it('respeta los porcentajes de la mezcla', () => {
    const real = repartoReal(POR_ALEATORIO(mezcla({ Franco: 60, Arena: 25, Limo: 15 }), config(), 42));
    cerca(real.Franco, 60);
    cerca(real.Arena, 25);
    cerca(real.Limo, 15);
  });

  it('las manchas cumplen los cupos exactos y agrupan celdas', () => {
    const cfg = config('demo', 3);
    const manchas = POR_MANCHAS(mezcla({ Franco: 50, Arena: 50 }), cfg, 3);
    const aleatorio = POR_ALEATORIO(mezcla({ Franco: 50, Arena: 50 }), cfg, 3);

    // Cupos exactos: en 144 celdas, 50 % son 72 de cada clase.
    cerca(repartoReal(manchas).Franco, 50);
    expect(celdasAisladas(manchas, cfg)).toBeLessThan(celdasAisladas(aleatorio, cfg));
  });

  it('una mezcla de una sola clase llena toda la parcela', () => {
    const cfg = config('demo');
    expect(new Set(repartirSuelos(mezcla({ Arcilla: 100 }), cfg))).toEqual(new Set(['Arcilla']));
  });
});
