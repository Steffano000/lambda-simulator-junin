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

describe('piloto: parcela dibujada → chunks → rendimiento → 3D', () => {
  it('el tamaño de chunk se adapta: 1 m en 1 ha, 30 m o más en parcelas grandes', async () => {
    const { tamanoChunk, cuadrado, construirChunks, areaHa } = await import('./parcela');
    expect(tamanoChunk(cuadrado(-12, -75.3, 99))).toBe(1);
    expect(tamanoChunk(cuadrado(-12, -75.3, 290))).toBe(3);
    expect(tamanoChunk(cuadrado(-12, -75.3, 2500))).toBe(30);
    expect(tamanoChunk(cuadrado(-12, -75.3, 5000))).toBe(60);
    // un rombo de 1 ha: los chunks (2 m) cubren su área con menos de 3 % de error
    const rombo: [number, number][] = [
      [-75.3228, -12.0374],
      [-75.3219, -12.0383],
      [-75.3228, -12.0392],
      [-75.3237, -12.0383],
    ];
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const g = construirChunks(rombo, { grilla, parcelas: [], reglas: n.reglas });
    const areaChunks = (g.chunks.filter((c) => c.dentro).length * g.celda_m ** 2) / 10_000;
    expect(Math.abs(areaChunks - areaHa(rombo)) / areaHa(rombo)).toBeLessThan(0.03);
  });

  it('parcela de 9 ha en Huayao: datos a 30 m, apta y con rendimiento por chunk', async () => {
    const { construirChunks, cuadrado, areaHa, resumirParcela, rendimientoPorChunk } =
      await import('./parcela');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const parcelas = await Promise.all(n.puntos.map((p) => fuente.parcela(p.id)));
    const anillo = cuadrado(-12.0383, -75.3228, 300);
    expect(areaHa(anillo)).toBeCloseTo(9, 0);
    const g = construirChunks(anillo, { grilla, parcelas, reglas: n.reglas });
    expect(g.celda_m).toBe(5); // 300 m / 100 chunks = 3 m justo; por redondeo pasa a 5 m
    expect(g.filas * g.columnas).toBeGreaterThan(3000);
    const res = resumirParcela(g, n.reglas);
    expect(res.puede_sembrar).toBe(true);
    expect(res.pct_30m).toBe(100);
    const r = rendimiento('huayao_igp', 'normal', 'papa', null, n)!;
    const rc = rendimientoPorChunk(
      g,
      r.rend_t_ha,
      n.catalogo.cultivos.papa.ecocrop,
      9,
      n.sim.puntos.huayao_igp.suelo.ph,
    );
    expect(rc.rend_parcela_t_ha).toBeGreaterThan(r.rend_t_ha * 0.9);
    expect(rc.rend_parcela_t_ha).toBeLessThanOrEqual(r.rend_t_ha);
  });

  it('parcela urbana en Huancayo se bloquea; fuera de Junín se detecta', async () => {
    const { construirChunks, cuadrado, resumirParcela, enGeojson } = await import('./parcela');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const parcelas = await Promise.all(n.puntos.map((p) => fuente.parcela(p.id)));
    const g = construirChunks(cuadrado(-12.0651, -75.2049, 300), { grilla, parcelas, reglas: n.reglas });
    expect(resumirParcela(g, n.reglas).puede_sembrar).toBe(false);
    const region = await fuente.limiteRegion();
    expect(enGeojson(-12.0383, -75.3228, region)).not.toBeNull();
    expect(enGeojson(-12.05, -77.05, region)).toBeNull(); // Lima
  });

  it('una parcela fuera de las ventanas de 30 m usa la grilla de 1 km', async () => {
    const { construirChunks, cuadrado, resumirParcela } = await import('./parcela');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const g = construirChunks(cuadrado(-11.6, -75.4, 200), { grilla, parcelas: [], reglas: n.reglas });
    expect(g.chunks.every((c) => c.fuente === '1km')).toBe(true);
    expect(resumirParcela(g, n.reglas).elevacion_media_m).toBeGreaterThan(3000);
  });

  it('el puente al simulador 3D marca celdas bloqueadas y respeta los suelos', async () => {
    const { construirChunks, cuadrado } = await import('./parcela');
    const { parcelaParaSimulador } = await import('./puente');
    const terrenos = JSON.parse(readFileSync(resolve(BASE, '../../../data/terrenos.json'), 'utf-8')).terrenos;
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const parcelas = await Promise.all(n.puntos.map((p) => fuente.parcela(p.id)));
    const g = construirChunks(cuadrado(-12.0383, -75.3228, 300), { grilla, parcelas, reglas: n.reglas });
    const p = parcelaParaSimulador(g, terrenos, {});
    expect(p.tiles).toHaveLength(p.config.rows * p.config.cols);
    expect(p.dominante.clase).toBe('Franco arcilloso');
    expect(p.tiles.filter((t) => !t.bloqueado).every((t) => t.suelo.clase === 'Franco arcilloso')).toBe(true);
    expect(p.celdasBloqueadas).toBeLessThan(p.tiles.length / 2);
  });
});

describe('selección en la parcela real', () => {
  it('nunca incluye celdas bloqueadas', async () => {
    const { SelectionController } = await import('@/controllers/SelectionController');
    const { useSimStore } = await import('@/store/useSimStore');
    const { container } = await import('@/app/container');
    const { construirChunks } = await import('./parcela');
    const { parcelaParaSimulador } = await import('./puente');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const parcelas = await Promise.all(n.puntos.map((p) => fuente.parcela(p.id)));
    const rombo: [number, number][] = [
      [-75.3228, -12.0378],
      [-75.3223, -12.0383],
      [-75.3228, -12.0388],
      [-75.3233, -12.0383],
    ];
    const g = construirChunks(rombo, { grilla, parcelas, reglas: n.reglas });
    const p = parcelaParaSimulador(g, container.terrains.clases(), {});
    useSimStore.setState({ tiles: p.tiles, config: p.config, seleccion: [] });
    const sel = new SelectionController(useSimStore, container);
    const esquina = p.tiles.find((t) => t.coords.x === 0 && t.coords.z === 0)!;
    const opuesta = p.tiles.find(
      (t) => t.coords.x === p.config.cols - 1 && t.coords.z === p.config.rows - 1,
    )!;
    expect(esquina.bloqueado).toBeTruthy();
    sel.begin(esquina.id);
    sel.extend(opuesta.id);
    sel.end();
    const ids = new Set(useSimStore.getState().seleccion);
    const libres = p.tiles.filter((t) => !t.bloqueado);
    expect(ids.size).toBe(libres.length);
    expect(p.tiles.filter((t) => ids.has(t.id)).every((t) => !t.bloqueado)).toBe(true);
    sel.clear();
    sel.selectAll();
    expect(useSimStore.getState().seleccion).toHaveLength(libres.length);
  });
});
