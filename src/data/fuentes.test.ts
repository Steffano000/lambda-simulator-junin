import { afterEach, describe, expect, it, vi } from 'vitest';
import { descargasPorScript, esFresca, FUENTES } from './fuentes';
import { useRegistro } from './registro';
import { casasEnVivo } from './junin/osm';

const XML = `<osm><node id="1" lat="-11.7750" lon="-75.5000"/><node id="2" lat="-11.7750" lon="-75.4999"/>
<node id="3" lat="-11.7749" lon="-75.4999"/><way id="9"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/>
<tag k="building" v="yes"/></way></osm>`;

afterEach(() => vi.unstubAllGlobals());

describe('Fase 6 · origen y frescura', () => {
  it('cada fuente declara modo, actualización y uso', () => {
    for (const f of FUENTES) {
      expect(f.actualizacion.length).toBeGreaterThan(3);
      expect(f.uso.length).toBeGreaterThan(3);
    }
    expect(FUENTES.find((f) => f.id === 'casas')!.ttl_h).toBe(24);
  });

  it('fecha de descarga más reciente y correcta por paso del pipeline', () => {
    const m = descargasPorScript([
      { fecha_hora: '2026-10-02T05:00:00', script: 4, estado: 'ok' },
      { fecha_hora: '2026-10-02T06:00:00', script: 4, estado: 'ok' },
      { fecha_hora: '2026-10-02T07:00:00', script: 4, estado: 'error' },
    ]);
    expect(m.get('4')).toBe('2026-10-02T06:00:00');
  });

  it('una copia caduca después de su TTL', () => {
    const t = Date.parse('2026-10-03T12:00:00Z');
    expect(esFresca('2026-10-03T00:00:00Z', 24, t)).toBe(true);
    expect(esFresca('2026-10-01T00:00:00Z', 24, t)).toBe(false);
    expect(esFresca('2000-01-01T00:00:00Z', null, t)).toBe(true);
  });

  it('casas: si OpenStreetMap falla se usa la última copia buena y se avisa', async () => {
    const bbox: [number, number, number, number] = [-75.5001, -11.7751, -75.4998, -11.7748];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(XML, { status: 200 })),
    );
    const ok = await casasEnVivo(bbox, true);
    expect(ok.estado).toBe('ok');
    expect(ok.casas).toHaveLength(1);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('sin red');
      }),
    );
    const respaldo = await casasEnVivo(bbox, true);
    expect(respaldo.respaldo).toBe(true);
    expect(respaldo.casas).toHaveLength(1);
    expect(respaldo.mensaje).toMatch(/copia guardada/);
    const ult = useRegistro.getState().consultas[0];
    expect(ult).toMatchObject({ fuente: 'casas', estado: 'respaldo' });

    // sin forzar, dentro de las 24 h no se vuelve a consultar
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await casasEnVivo(bbox);
    expect(f).not.toHaveBeenCalled();
  });

  it('casas: sin copia y sin red → error explícito (nunca «no hay casas» en silencio)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('sin red');
      }),
    );
    const r = await casasEnVivo([-75.3, -12.1, -75.2999, -12.0999], true);
    expect(r.estado).toBe('error');
    expect(r.mensaje).toMatch(/NO se verificaron/);
  });
});
