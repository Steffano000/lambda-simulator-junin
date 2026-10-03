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
    // un rombo de 1 ha: con la fracción exacta de cada chunk el área coincide (< 0.5 %)
    const rombo: [number, number][] = [
      [-75.3228, -12.0374],
      [-75.3219, -12.0383],
      [-75.3228, -12.0392],
      [-75.3237, -12.0383],
    ];
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const g = construirChunks(rombo, { grilla, parcelas: [], reglas: n.reglas });
    const areaChunks = (g.chunks.reduce((a, c) => a + c.fraccion, 0) * g.celda_m ** 2) / 10_000;
    expect(Math.abs(areaChunks - areaHa(rombo)) / areaHa(rombo)).toBeLessThan(0.005);
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
    const p = parcelaParaSimulador(g, terrenos);
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
    const p = parcelaParaSimulador(g, container.terrains.clases());
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

describe('Fase 1: estado de los chunks y área exacta', () => {
  const base = {
    fila: 0,
    columna: 0,
    lat: -12,
    lon: -75.3,
    dentro: true,
    fraccion: 1,
    elevacion_m: 3300,
    pendiente_grados: 2,
    worldcover: 40,
    regla: 'permitido' as const,
    arena_pct: 40,
    arcilla_pct: 30,
    limo_pct: 30,
    cos_pct: 2,
    ph: 6.5,
    ndvi: 0.5,
    textura: 'Franco arcilloso',
    fuente: '30m' as const,
    estado: 'con_dato' as const,
    motivo: null,
    bloqueo: null,
  };
  const sin = { areaProtegida: null, enCasa: false, distanciaClimaM: 1000 };

  it('clasificador: con dato, interpolado, sin dato y bloqueado', async () => {
    const { clasificarChunk, MAX_DIST_DATO_M } = await import('./estadoChunk');
    expect(clasificarChunk(base, sin, n.reglas).estado).toBe('con_dato');
    expect(clasificarChunk({ ...base, fuente: '1km' }, sin, n.reglas).estado).toBe('interpolado');
    const sd = clasificarChunk({ ...base, ph: null }, sin, n.reglas);
    expect(sd.estado).toBe('sin_dato');
    expect(sd.motivo).toMatch(/suelo/);
    expect(clasificarChunk({ ...base, elevacion_m: null }, sin, n.reglas).motivo).toMatch(/altura/);
    const lejos = clasificarChunk(base, { ...sin, distanciaClimaM: MAX_DIST_DATO_M + 1 }, n.reglas);
    expect(lejos.estado).toBe('sin_dato');
    expect(lejos.motivo).toMatch(/clima/);
    expect(clasificarChunk({ ...base, worldcover: 50, regla: 'bloqueado' }, sin, n.reglas)).toMatchObject({
      estado: 'bloqueado',
      bloqueo: 'cobertura',
    });
    expect(
      clasificarChunk(base, { ...sin, areaProtegida: 'Reserva Paisajística Nor Yauyos-Cochas' }, n.reglas),
    ).toMatchObject({
      estado: 'bloqueado',
      bloqueo: 'area_protegida',
    });
    expect(clasificarChunk(base, { ...sin, enCasa: true }, n.reglas)).toMatchObject({
      estado: 'bloqueado',
      bloqueo: 'casa',
    });
    // lo bloqueado manda aunque falten datos (ciudad: SoilGrids no tiene suelo)
    expect(
      clasificarChunk({ ...base, ph: null, worldcover: 50, regla: 'bloqueado' }, sin, n.reglas).estado,
    ).toBe('bloqueado');
  });

  it('el área de los chunks coincide con el área real del polígono (fracción exacta en el borde)', async () => {
    const { construirChunks, areaHa, resumirParcela } = await import('./parcela');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const parcelas = await Promise.all(n.puntos.map((p) => fuente.parcela(p.id)));
    // polígono irregular de ~1 ha en Huayao
    const poly: [number, number][] = [
      [-75.3232, -12.0379],
      [-75.3222, -12.0377],
      [-75.3219, -12.0386],
      [-75.3227, -12.039],
      [-75.3234, -12.0385],
    ];
    const g = construirChunks(poly, { grilla, parcelas, reglas: n.reglas });
    const r = resumirParcela(g, n.reglas);
    expect(Math.abs(r.area_total_ha - areaHa(poly)) / areaHa(poly)).toBeLessThan(0.005);
    expect(g.chunks.some((c) => c.fraccion > 0 && c.fraccion < 1)).toBe(true);
  });

  it('casas (OpenStreetMap) y áreas protegidas bloquean sus chunks; nada sin dato entra al rendimiento', async () => {
    const { construirChunks, cuadrado, resumirParcela, rendimientoPorChunk } = await import('./parcela');
    const { prepararChunks, indexarPoligonos } = await import('./estadoChunk');
    const { parsearOverpass } = await import('@/data/junin/osm');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const parcelas = await Promise.all(n.puntos.map((p) => fuente.parcela(p.id)));
    const anillo = cuadrado(-12.0383, -75.3228, 100);
    let g = construirChunks(anillo, { grilla, parcelas, reglas: n.reglas });
    const antes = resumirParcela(g, n.reglas);
    // una casa de ~10 x 10 m en el centro, con el formato que devuelve Overpass
    const d = 0.000045;
    const casas = parsearOverpass({
      elements: [
        {
          type: 'way',
          geometry: [
            { lat: -12.0383 + d, lon: -75.3228 - d },
            { lat: -12.0383 + d, lon: -75.3228 + d },
            { lat: -12.0383 - d, lon: -75.3228 + d },
            { lat: -12.0383 - d, lon: -75.3228 - d },
          ],
        },
      ],
    });
    g = prepararChunks(g, anillo, { reglas: n.reglas, casas, distanciaClimaM: 0 });
    const r = resumirParcela(g, n.reglas);
    const bloqCasa = g.chunks.filter((c) => c.bloqueo === 'casa');
    // 10 x 10 m de casa + 5 m de margen ≈ 20 x 20 m = 0.04 ha (± borde de chunk)
    expect(bloqCasa.length * g.celda_m ** 2).toBeGreaterThan(250);
    expect(bloqCasa.length * g.celda_m ** 2).toBeLessThan(500);
    expect(r.area_efectiva_ha).toBeLessThan(antes.area_efectiva_ha);
    // área protegida que cubre toda la parcela
    const prot = indexarPoligonos(
      {
        features: [
          {
            properties: { NAME: 'Prueba' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-76, -13],
                  [-74, -13],
                  [-74, -11],
                  [-76, -11],
                  [-76, -13],
                ],
              ],
            },
          },
        ],
      },
      (p) => String(p.NAME),
    );
    const gp = prepararChunks(g, anillo, { reglas: n.reglas, protegidas: prot });
    const rp = resumirParcela(gp, n.reglas);
    expect(rp.puede_sembrar).toBe(false);
    expect(rp.areas_protegidas).toContain('Prueba');
    // sin dato: el rendimiento y el área efectiva solo usan chunks con datos
    const conHueco = {
      ...g,
      chunks: g.chunks.map((c, i) => (i % 2 ? { ...c, estado: 'sin_dato' as const } : c)),
    };
    const rc = rendimientoPorChunk(conHueco, 10, n.catalogo.cultivos.papa.ecocrop, 6.5);
    expect(rc.porChunk.filter((x, i) => i % 2 === 1 && x != null)).toHaveLength(0);
    expect(rc.area_ha).toBeLessThan(resumirParcela(g, n.reglas).area_efectiva_ha * 0.6);
  });

  it('con poca área con datos el resultado no se da como confiable', async () => {
    const { construirChunks, cuadrado, resumirParcela } = await import('./parcela');
    const { prepararChunks } = await import('./estadoChunk');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const anillo = cuadrado(-12.0383, -75.3228, 100);
    const g = prepararChunks(construirChunks(anillo, { grilla, parcelas: [], reglas: n.reglas }), anillo, {
      reglas: n.reglas,
      distanciaClimaM: 80_000,
    });
    const r = resumirParcela(g, n.reglas);
    expect(r.datos_suficientes).toBe(false);
    expect(r.puede_sembrar).toBe(false);
    expect(r.sin_dato[0]).toMatch(/clima/);
  });

  it('en 3D: fuera del polígono no se dibuja; bloqueado y sin dato son losas que no se trabajan', async () => {
    const { construirChunks } = await import('./parcela');
    const { parcelaParaSimulador } = await import('./puente');
    const { container } = await import('@/app/container');
    const grilla = (await fuente.grillaJunin()) as GrillaCapas;
    const parcelas = await Promise.all(n.puntos.map((p) => fuente.parcela(p.id)));
    const rombo: [number, number][] = [
      [-75.3228, -12.0378],
      [-75.3223, -12.0383],
      [-75.3228, -12.0388],
      [-75.3233, -12.0383],
    ];
    const p = parcelaParaSimulador(
      construirChunks(rombo, { grilla, parcelas, reglas: n.reglas }),
      container.terrains.clases(),
    );
    const ocultas = p.tiles.filter((t) => t.oculto);
    expect(ocultas.length).toBeGreaterThan(0);
    expect(ocultas.every((t) => t.bloqueado)).toBe(true);
    expect(p.tiles.filter((t) => !t.bloqueado).every((t) => t.suelo.n > 0)).toBe(true);
  });
});

describe('casas desde la API oficial de OpenStreetMap', () => {
  it('lee los edificios del XML de /api/0.6/map', async () => {
    const { parsearOsmXml } = await import('@/data/junin/osm');
    const xml = `<osm>
 <node id="1" visible="true" version="1" lat="-11.7750" lon="-75.5000"/>
 <node id="2" visible="true" version="1" lat="-11.7750" lon="-75.4999"/>
 <node id="3" visible="true" version="1" lat="-11.7751" lon="-75.4999"/>
 <node id="4" visible="true" version="1" lat="-11.7751" lon="-75.5000"/>
 <way id="10" visible="true"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="house"/></way>
 <way id="11" visible="true"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="highway" v="track"/></way>
</osm>`;
    const casas = parsearOsmXml(xml);
    expect(casas).toHaveLength(1);
    expect(casas[0][0]).toEqual([-75.5, -11.775]);
  });
});
