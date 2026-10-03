/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { JuninDataSource } from '@/data/junin/JuninDataSource';
import type { GrillaCapas, Manifiesto, NucleoJunin, Parcela } from '@/data/junin/types';
import { ClimateScenarioFactory } from '@/domain/climate';
import {
  aClimaMes,
  celdasDeParcela,
  climaEscenario,
  efectoRotacion,
  escenariosComoClima,
  evaluarParcela,
  menuCultivos,
  motorDe,
  puntoMasCercano,
  rendimiento,
  terrenoEnPunto,
  ventanaCentral,
} from './index';

const BASE = fileURLToPath(new URL('../../../public/data/junin', import.meta.url));
const fuente = new JuninDataSource(async (ruta) => JSON.parse(readFileSync(resolve(BASE, ruta), 'utf-8')));

let n: NucleoJunin;
beforeAll(async () => {
  n = await fuente.nucleo();
});

describe('public/data/junin: archivos', () => {
  it('todo lo que lista manifest.json existe y es JSON válido (sin NaN ni Infinity)', async () => {
    const man = await fuente.manifiesto();
    expect(man.archivos.length).toBeGreaterThan(40);
    for (const a of (man as Manifiesto).archivos) {
      const ruta = resolve(BASE, a.archivo);
      expect(existsSync(ruta), a.archivo).toBe(true);
      const texto = readFileSync(ruta, 'utf-8');
      expect(() => JSON.parse(texto), a.archivo).not.toThrow();
      expect(/\bNaN\b|-?Infinity\b/.test(texto.replace(/"[^"]*"/g, '""')), a.archivo).toBe(false);
    }
  });

  it('los 10 puntos tienen escenarios de 24 meses y 5 cultivos con balance', () => {
    expect(Object.keys(n.sim.puntos)).toHaveLength(10);
    for (const p of Object.values(n.sim.puntos)) {
      for (const esc of Object.values(p.escenarios)) {
        expect(esc.meses).toHaveLength(24);
        expect(Object.keys(esc.cultivos)).toEqual([
          'papa',
          'maiz_amilaceo',
          'quinua',
          'haba',
          'avena_forrajera',
        ]);
      }
      expect(p.suelo.cc_m3m3).not.toBeNull();
    }
  });
});

describe('motor de Junín', () => {
  it('ubica el punto más cercano', () => {
    expect(puntoMasCercano(-12.03, -75.31, n.sim)).toBe('huayao_igp');
    expect(puntoMasCercano(-11.26, -74.64, n.sim)).toBe('satipo');
  });

  it('menú de la provincia con el motor de cada cultivo', () => {
    const menu = menuCultivos('huayao_igp', n);
    expect(menu.length).toBeGreaterThan(5);
    expect(menu.every((c) => c.de_la_provincia && c.porcentaje >= 1)).toBe(true);
    expect(motorDe('huayao_igp', 'papa', n.sim, n.aquacrop)).toBe('balance_fao56');
    expect(motorDe('huayao_igp', 'cebada', n.sim, n.aquacrop)).toBe('aquacrop');
    expect(motorDe('huayao_igp', 'olluco', n.sim, n.aquacrop)).toBe('dra_aptitud');
  });

  it('clima de 24 meses con semáforo P/ET0 coherente', () => {
    const c = climaEscenario('huayao_igp', 'nino', n.sim);
    expect(c).toHaveLength(24);
    for (const m of c) {
      expect(m.semaforo).toBe(m.indice >= 1 ? 'verde' : m.indice >= 0.5 ? 'ambar' : 'rojo');
    }
  });

  it('rotación: papa después de haba × 1.1; sin regla = 1', () => {
    expect(efectoRotacion('haba', 'papa', n.fenologia)).toBe(1.1);
    expect(efectoRotacion('papa', 'papa', n.fenologia)).toBe(0.75);
    expect(efectoRotacion(null, 'papa', n.fenologia)).toBe(1);
  });

  it('rendimiento FAO-56 = referencia DRA × factor de agua × rotación', () => {
    const r = rendimiento('huayao_igp', 'nino', 'papa', 'haba', n)!;
    const camp = n.sim.puntos.huayao_igp.escenarios.nino.cultivos.papa[0];
    expect(r.motor).toBe('balance_fao56');
    expect(r.rend_t_ha).toBeCloseTo(camp.rend_ref_t_ha * camp.factor_agua * 1.1, 1);
    expect(r.referencia_aquacrop_t_ha).not.toBeNull();
    expect(r.etiqueta).toMatch(/PISCO/);
  });

  it('cebada usa AquaCrop y olluco usa DRA × aptitud', () => {
    const ceb = rendimiento('huayao_igp', 'normal', 'cebada', null, n)!;
    expect(ceb.motor).toBe('aquacrop');
    expect(ceb.rend_t_ha).toBeGreaterThan(0);
    const oll = rendimiento('huayao_igp', 'normal', 'olluco', null, n)!;
    expect(oll.motor).toBe('dra_aptitud');
    expect(oll.componentes.aptitud).not.toBeNull();
  });
});

describe('grillas y parcelas', () => {
  it('la grilla de 1 km responde lo mismo que el antiguo GET /terreno', async () => {
    const g = await fuente.grillaJunin();
    const t = terrenoEnPunto(g as GrillaCapas, -12.0383, -75.3228)!;
    expect(t.elevacion_m).toBeGreaterThan(3000);
    expect(t.elevacion_m).toBeLessThan(3600);
    expect(t.worldcover).toBe(40); // cultivos
    expect(typeof t.textura_app).toBe('string');
    expect(terrenoEnPunto(g as GrillaCapas, -5, -70)).toBeNull();
  });

  it('parcela de Huayao: agrícola, franco arcillosa y se puede sembrar', async () => {
    const p = (await fuente.parcela('huayao_igp')) as Parcela;
    const celdas = celdasDeParcela(p);
    expect(celdas).toHaveLength(1600);
    expect(evaluarParcela(celdas).puede_sembrar).toBe(true);
    expect(p.resumen.texturas_pct['Franco arcilloso']).toBeGreaterThan(50);
    expect(ventanaCentral(celdas, 40, 20)).toHaveLength(400);
  });

  it('parcela en el centro de Huancayo: urbana, no se puede sembrar', async () => {
    const p = (await fuente.parcela('huancayo')) as Parcela;
    expect(evaluarParcela(celdasDeParcela(p)).puede_sembrar).toBe(false);
  });
});

describe('adaptador al clima de la app', () => {
  it('convierte un escenario SARIMAX en 12 ClimaMes válidos para ClimateScenarioFactory', () => {
    const meses = aClimaMes(n.sim.puntos.huayao_igp.escenarios.nino.meses);
    expect(meses.map((m) => m.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const fab = new ClimateScenarioFactory(escenariosComoClima(n.sim, 'huayao_igp'));
    expect(fab.reales()).toHaveLength(5);
    const esc = fab.create(fab.reales()[3]);
    expect(esc.mes(1).lluvia).toBeGreaterThan(0);
  });
});
