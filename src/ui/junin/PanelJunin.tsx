/**
 * Rama "decidir": la secuencia completa del piloto (pasos 1 a 12 de ARQUITECTURA_HIBRIDA.md).
 * Todos los números salen de los JSON locales validados en Junín.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { juninController as jc } from '@/controllers/JuninController';
import type { EscenarioId } from '@/data/junin/types';
import { API_URL } from '@/data/junin/servidor';
import {
  climaEscenario,
  CULTIVO_SIMULADOR,
  ESCENARIOS,
  ETIQUETA_SIMULACION,
  menuCultivos,
  MOTOR_ETIQUETA,
  PENALIZACION_ADVERTENCIA,
} from '@/domain/junin';
import { useJuninStore, type BaseNasa, type CapaChunk, type OverlayNasa } from '@/store/juninStore';
import {
  BASES_HD,
  BASES_NASA,
  COLOR_REGLA,
  ETIQUETA_CAPA,
  leyendaCapa,
  NOMBRE_BASE,
  OVERLAYS_NASA,
} from './colores';
import { GraficoEscenario } from './GraficoEscenario';
import { useResultadoJunin } from './useJunin';

function Paso({
  n,
  titulo,
  children,
  apagado,
}: {
  n: number | string;
  titulo: string;
  children: ReactNode;
  apagado?: boolean;
}) {
  return (
    <section className={`border-b border-ui-border px-4 py-3 ${apagado ? 'opacity-50' : ''}`}>
      <h2 className="mb-2 flex items-center gap-2 text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-panel-2 px-1 whitespace-nowrap text-ui-ink">
          {n}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

const Dato = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex justify-between gap-2 py-0.5 text-xs">
    <span className="text-ui-ink-muted">{k}</span>
    <span className="value text-right">{v}</span>
  </div>
);

const fmt = (x: number | null | undefined, d = 1) => (x == null ? '—' : x.toFixed(d));

const ESC_CORTO: Record<EscenarioId, string> = {
  normal: 'Normal',
  actual: 'Actual',
  neutro: 'Neutro',
  nino: 'El Niño',
  nina: 'La Niña',
};

export function PanelJunin() {
  const s = useJuninStore(
    useShallow((st) => ({
      cargando: st.cargando,
      error: st.error,
      nucleo: st.nucleo,
      fecha: st.fecha,
      base: st.base,
      overlays: st.overlays,
      verProtegidas: st.verProtegidas,
      dibujando: st.dibujando,
      borrador: st.borrador,
      anillo: st.anillo,
      area_ha: st.area_ha,
      chunks: st.chunks,
      resumen: st.resumen,
      ubicacion: st.ubicacion,
      capaChunk: st.capaChunk,
      escenario: st.escenario,
      cultivo: st.cultivo,
      anterior: st.anterior,
      campana: st.campana,
      plan: st.plan,
      servidor: st.servidor,
    })),
  );
  const res = useResultadoJunin();
  const [ejemplo, setEjemplo] = useState('huayao_igp');
  const [otros, setOtros] = useState(false);

  const n = s.nucleo;
  const u = s.ubicacion;
  const listo = !!(u && !u.fuera_de_junin && s.resumen?.puede_sembrar);

  const menu = useMemo(() => (n && u ? menuCultivos(u.punto, n, true) : []), [n, u]);
  const clima = useMemo(
    () => (n && u ? climaEscenario(u.punto, s.escenario, n.sim) : []),
    [n, u, s.escenario],
  );
  const mesesEsc = n && u ? n.sim.puntos[u.punto].escenarios[s.escenario].meses : [];
  const camp =
    n && u && s.cultivo
      ? n.sim.puntos[u.punto].escenarios[s.escenario].cultivos[s.cultivo]?.[s.campana]
      : undefined;
  const mesesCampana = useMemo(() => new Set(camp ? Object.keys(camp.mensual) : []), [camp]);
  const feno = n?.fenologia.cultivos.find((c) => c.id === s.cultivo);

  const elevs =
    s.chunks?.chunks.filter((c) => c.dentro && c.elevacion_m != null).map((c) => c.elevacion_m!) ?? [];
  const ctxLeyenda = {
    elevMin: elevs.length ? Math.min(...elevs) : 0,
    elevMax: elevs.length ? Math.max(...elevs) : 1,
    rendMax: Math.max(0.01, ...(res?.rc?.porChunk ?? []).map((x) => x ?? 0)),
  };

  if (s.error && !n) return <div className="p-4 text-xs text-ui-danger">{s.error}</div>;
  if (!n) return <div className="p-4 text-xs text-ui-ink-muted">{s.cargando ?? 'Cargando…'}</div>;

  const fueraMsg = u?.fuera_de_junin ? (
    <p className="text-xs text-ui-danger">
      La parcela está fuera de Junín: el mapa NASA se ve, pero el simulador está disponible solo en Junín.
    </p>
  ) : null;

  return (
    <div className="text-xs">
      {s.cargando && (
        <div className="sticky top-0 z-10 bg-ui-accent px-4 py-1 text-ui-accent-ink">{s.cargando}</div>
      )}
      {s.error && <div className="bg-red-50 px-4 py-1 text-ui-danger">{s.error}</div>}

      <Paso n={1} titulo="Mapa">
        <div className="mb-1 text-2xs text-ui-ink-muted">Para dibujar (alta resolución)</div>
        <div className="mb-2 grid grid-cols-2 gap-1">
          {(['esri', 'eox'] as BaseNasa[]).map((b) => (
            <button
              key={b}
              className={`btn justify-center ${s.base === b ? 'btn-active' : ''}`}
              onClick={() => jc.setBase(b)}
              title={BASES_HD[b as 'esri' | 'eox'].nombre}
            >
              {NOMBRE_BASE[b]}
            </button>
          ))}
        </div>
        <div className="mb-1 text-2xs text-ui-ink-muted">Imagen NASA del día (contexto)</div>
        <div className="mb-2 grid grid-cols-3 gap-1">
          {(Object.keys(BASES_NASA) as BaseNasa[]).map((b) => (
            <button
              key={b}
              className={`btn justify-center ${s.base === b ? 'btn-active' : ''}`}
              onClick={() => jc.setBase(b)}
              title={BASES_NASA[b as 'modis' | 'viirs' | 'hls'].nombre}
            >
              {NOMBRE_BASE[b]}
            </button>
          ))}
        </div>
        <label className="mb-2 flex items-center gap-2">
          <span className="text-ui-ink-muted">Fecha</span>
          <input
            type="date"
            className="field"
            value={s.fecha}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => jc.setFecha(e.target.value)}
          />
          <button className="btn px-2" title="Día anterior" onClick={() => jc.moverFecha(-1)}>
            ◀
          </button>
          <button className="btn px-2" title="Día siguiente" onClick={() => jc.moverFecha(1)}>
            ▶
          </button>
        </label>
        <p className="mb-2 text-2xs text-ui-ink-muted">
          La fecha aplica a las imágenes y capas NASA. MODIS y VIIRS pasan una vez al día y a veces hay nubes
          o franjas sin imagen: cambia de día con ◀ ▶. Acerca el mapa con «Satélite HD» para ver bien los
          predios.
        </p>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(OVERLAYS_NASA) as OverlayNasa[]).map((o) => (
            <label key={o} className="flex items-center gap-1.5">
              <input type="checkbox" checked={s.overlays[o]} onChange={() => jc.toggleOverlay(o)} />
              {OVERLAYS_NASA[o].nombre}
            </label>
          ))}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={s.verProtegidas} onChange={() => jc.toggleProtegidas()} />
            Áreas protegidas
          </label>
        </div>
        <p className="mt-2 text-2xs text-ui-ink-muted">
          Las imágenes son solo para ver y dibujar: no entran en los cálculos. Las capas NASA son contexto,
          sin corrección local.
        </p>
      </Paso>

      <Paso n={2} titulo="Delimitar la parcela">
        {!s.dibujando ? (
          <div className="flex flex-wrap gap-1">
            <button className="btn btn-active" onClick={() => jc.empezarDibujo()}>
              Dibujar parcela
            </button>
            {s.anillo && (
              <button className="btn" onClick={() => jc.borrarParcela()}>
                Borrar
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <button
              className="btn btn-active"
              disabled={s.borrador.length < 3}
              onClick={() => void jc.terminarDibujo()}
            >
              Cerrar polígono ({s.borrador.length})
            </button>
            <button className="btn" disabled={!s.borrador.length} onClick={() => jc.deshacerVertice()}>
              Deshacer
            </button>
            <button className="btn" onClick={() => jc.cancelarDibujo()}>
              Cancelar
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center gap-1">
          <select className="field" value={ejemplo} onChange={(e) => setEjemplo(e.target.value)}>
            {n.puntos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} ({p.provincia})
              </option>
            ))}
          </select>
          <button className="btn shrink-0" onClick={() => void jc.usarEjemplo(ejemplo)}>
            Ejemplo 9 ha
          </button>
        </div>
        <p className="mt-1 text-2xs text-ui-ink-muted">
          También puedes hacer clic en el mapa y elegir «1 ha aquí». Los recuadros amarillos tienen datos a 30
          m.
        </p>
      </Paso>

      <Paso n={3} titulo="Área" apagado={!s.anillo}>
        <Dato k="Superficie" v={`${fmt(s.area_ha, 2)} ha`} />
        {s.area_ha > 100 && (
          <p className="text-amber-700">
            Parcela muy grande: los datos se promedian en chunks de más de 30 m. Acerca el mapa y dibuja una
            chacra (menos de 50 ha).
          </p>
        )}
        {s.chunks && (
          <>
            <Dato
              k="Chunks"
              v={`${s.chunks.filas} × ${s.chunks.columnas} de ${s.chunks.celda_m} m (${s.resumen?.n_dentro} dentro)`}
            />
            <Dato
              k="Origen de los datos"
              v={
                s.chunks.origen === 'servidor'
                  ? 'Servidor (TIF a 30 m)'
                  : `${s.resumen?.pct_30m}% a 30 m · resto a ~1 km`
              }
            />
          </>
        )}
      </Paso>

      <Paso n={4} titulo="¿Es apta? (uso de suelo)" apagado={!s.resumen}>
        {fueraMsg}
        {s.resumen && !u?.fuera_de_junin && (
          <>
            <div
              className={`mb-2 rounded px-2 py-1 font-semibold ${s.resumen.puede_sembrar ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}
            >
              {s.resumen.puede_sembrar
                ? 'Se puede sembrar'
                : 'No se puede sembrar: más del 50 % es ciudad, agua, nieve u otra zona bloqueada'}
            </div>
            <div className="mb-1 flex h-2 overflow-hidden rounded">
              {(['permitido', 'advertencia', 'bloqueado'] as const).map((k) => (
                <div
                  key={k}
                  style={{ width: `${s.resumen!.pct[k]}%`, background: COLOR_REGLA[k] }}
                  title={`${k} ${s.resumen!.pct[k]}%`}
                />
              ))}
            </div>
            <div className="mb-1 text-2xs text-ui-ink-muted">
              Permitido {s.resumen.pct.permitido}% · advertencia {s.resumen.pct.advertencia}% · bloqueado{' '}
              {s.resumen.pct.bloqueado}%
            </div>
            {s.resumen.advertencias.map((a) => (
              <p key={a} className="text-amber-700">
                ⚠ {a}
              </p>
            ))}
            {s.resumen.bloqueos.map((a) => (
              <p key={a} className="text-ui-danger">
                ⛔ {a}
              </p>
            ))}
            {u?.area_protegida && (
              <p className="text-amber-700">⚠ Dentro de un área natural protegida: {u.area_protegida}.</p>
            )}
            {s.resumen.advertencias.length > 0 && (
              <p className="mt-1 text-2xs text-ui-ink-muted">
                Los chunks en advertencia rinden × {PENALIZACION_ADVERTENCIA} (supuesto del piloto).
              </p>
            )}
          </>
        )}
      </Paso>

      <Paso n={5} titulo="Ubicación de la parcela" apagado={!u || u.fuera_de_junin}>
        {u && !u.fuera_de_junin && s.resumen && (
          <>
            <Dato k="Punto con datos" v={`${u.punto} (${u.distancia_km.toFixed(1)} km)`} />
            <Dato k="Provincia" v={n.catalogo.provincias[u.provincia]?.nombre ?? u.provincia} />
            <Dato
              k="Piso ecológico"
              v={n.catalogo.pisos_ecologicos.find((p) => p.id === u.piso)?.nombre ?? '—'}
            />
            <Dato k="Altura media" v={`${fmt(s.resumen.elevacion_media_m, 0)} m`} />
            <Dato k="Pendiente media" v={`${fmt(s.resumen.pendiente_media_grados)}°`} />
            <Dato k="Textura dominante" v={s.resumen.textura_dominante ?? '—'} />
            <Dato k="pH medio" v={fmt(s.resumen.ph_medio)} />
            {(() => {
              const ep = n.puntos.find((p) => p.id === u.punto)?.elevacion_m;
              const dif =
                ep != null && s.resumen.elevacion_media_m != null ? s.resumen.elevacion_media_m - ep : 0;
              return Math.abs(dif) > 400 ? (
                <p className="mt-1 text-amber-700">
                  La parcela está {Math.abs(dif).toFixed(0)} m {dif > 0 ? 'más arriba' : 'más abajo'} que el
                  punto con datos ({ep} m): la temperatura y el riesgo de helada pueden ser distintos.
                </p>
              ) : null;
            })()}
            {u.distancia_km > 25 && (
              <p className="mt-1 text-amber-700">El punto con datos está lejos: el clima es aproximado.</p>
            )}
          </>
        )}
      </Paso>

      <Paso n={6} titulo="Grilla interactiva (chunks)" apagado={!s.chunks}>
        {s.chunks && (
          <>
            <div className="mb-2 flex flex-wrap gap-1">
              {(Object.keys(ETIQUETA_CAPA) as CapaChunk[])
                .filter((c) => c !== 'rendimiento' || res?.rc)
                .map((c) => (
                  <button
                    key={c}
                    className={`btn ${s.capaChunk === c ? 'btn-active' : ''}`}
                    onClick={() => jc.setCapaChunk(c)}
                  >
                    {ETIQUETA_CAPA[c]}
                  </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {leyendaCapa(
                s.capaChunk,
                ctxLeyenda,
                s.chunks.chunks.filter((c) => c.dentro),
              ).map(([color, txt]) => (
                <span key={txt} className="flex items-center gap-1 text-2xs">
                  <span className="swatch" style={{ background: color }} />
                  {txt}
                </span>
              ))}
            </div>
            <p className="mt-1 text-2xs text-ui-ink-muted">
              Pasa el cursor sobre la parcela para ver los datos de cada chunk.
            </p>
            {s.servidor === false && API_URL && (
              <p className="text-2xs text-amber-700">El servidor no responde: se usan los datos locales.</p>
            )}
          </>
        )}
      </Paso>

      <Paso n={7} titulo="Escenario climático (24 meses)" apagado={!listo}>
        {fueraMsg}
        {listo && (
          <>
            <div className="mb-2 grid grid-cols-5 gap-1">
              {ESCENARIOS.map((e) => (
                <button
                  key={e}
                  className={`btn justify-center px-1 ${s.escenario === e ? 'btn-active' : ''}`}
                  onClick={() => jc.setEscenario(e)}
                  title={n.sim.meta.escenarios[e]}
                >
                  {ESC_CORTO[e]}
                </button>
              ))}
            </div>
            <GraficoEscenario
              meses={clima}
              inf={mesesEsc.map((m) => m.lluvia_mm_inf80)}
              sup={mesesEsc.map((m) => m.lluvia_mm_sup80)}
              campana={mesesCampana}
            />
            <div className="mt-1 flex flex-wrap gap-x-3 text-2xs text-ui-ink-muted">
              <span>
                <span className="swatch" style={{ background: '#4A90C2' }} /> Lluvia
              </span>
              <span>
                <span className="swatch" style={{ background: '#E07B39' }} /> ET₀
              </span>
              <span>P/ET₀: verde ≥ 1 · ámbar 0.5–1 · rojo &lt; 0.5</span>
            </div>
            <Dato k="Lluvia 24 meses" v={`${clima.reduce((a, m) => a + m.lluvia, 0).toFixed(0)} mm`} />
            <Dato k="Meses con déficit severo" v={clima.filter((m) => m.semaforo === 'rojo').length} />
            <p className="mt-1 text-2xs font-medium text-ui-accent">{ETIQUETA_SIMULACION}</p>
          </>
        )}
      </Paso>

      <Paso n={8} titulo="Cultivo" apagado={!listo}>
        {listo && (
          <>
            <select
              className="field mb-1"
              value={s.cultivo ?? ''}
              onChange={(e) => jc.setCultivo(e.target.value || null)}
            >
              <option value="">— Elige un cultivo —</option>
              <optgroup
                label={`De ${n.catalogo.provincias[u!.provincia]?.nombre ?? 'la provincia'} (DRA 2022)`}
              >
                {menu
                  .filter((c) => c.de_la_provincia)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} · {c.porcentaje}% del área
                    </option>
                  ))}
              </optgroup>
              {otros && (
                <optgroup label="Otros (aptitud baja)">
                  {menu
                    .filter((c) => !c.de_la_provincia)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            <label className="mb-2 flex items-center gap-1.5 text-2xs">
              <input type="checkbox" checked={otros} onChange={() => setOtros(!otros)} /> Mostrar cultivos de
              otras provincias
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-2xs text-ui-ink-muted">Cultivo anterior</span>
                <select
                  className="field"
                  value={s.anterior ?? ''}
                  onChange={(e) => jc.setAnterior(e.target.value || null)}
                >
                  <option value="">Ninguno</option>
                  <option value="descanso">Descanso</option>
                  {menu.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-2xs text-ui-ink-muted">Campaña</span>
                <select
                  className="field"
                  value={s.campana}
                  onChange={(e) => jc.setCampana(Number(e.target.value))}
                >
                  <option value={0}>2026-27</option>
                  <option value={1}>2027-28</option>
                </select>
              </label>
            </div>
          </>
        )}
      </Paso>

      <Paso n="9-11" titulo="Motor de simulación y resultado" apagado={!res}>
        {listo && s.cultivo && !res && (
          <p className="text-ui-ink-muted">
            No hay rendimiento de referencia para este cultivo en la provincia.
          </p>
        )}
        {res && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <span className="rounded bg-ui-panel-2 px-1.5 py-0.5 text-2xs font-semibold">
                Motor: {res.r.motor_etiqueta}
              </span>
              {res.r.fuera_de_provincia && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-2xs text-amber-900">
                  Fuera de su provincia
                </span>
              )}
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1 text-center">
              <div className="rounded bg-ui-panel-2 p-1.5">
                <div className="value text-base font-semibold">
                  {res.rc ? res.rc.rend_parcela_t_ha.toFixed(2) : res.r.rend_t_ha.toFixed(2)}
                </div>
                <div className="text-2xs text-ui-ink-muted">t/ha en tu parcela</div>
              </div>
              <div className="rounded bg-ui-panel-2 p-1.5">
                <div className="value text-base font-semibold">
                  {res.rc ? res.rc.produccion_t.toFixed(1) : '—'}
                </div>
                <div className="text-2xs text-ui-ink-muted">t en {fmt(s.area_ha, 2)} ha</div>
              </div>
              <div className="rounded bg-ui-panel-2 p-1.5">
                <div className="value text-base font-semibold">{res.r.rend_t_ha.toFixed(2)}</div>
                <div className="text-2xs text-ui-ink-muted">t/ha del punto</div>
              </div>
            </div>
            <Dato k="Referencia DRA 2022" v={`${res.r.componentes.rend_ref_t_ha.toFixed(2)} t/ha`} />
            {res.r.componentes.factor_agua != null && (
              <Dato k="× Factor de agua (FAO-56)" v={res.r.componentes.factor_agua.toFixed(2)} />
            )}
            {res.r.motor === 'aquacrop' && (
              <Dato k="× Anomalía AquaCrop" v={fmt(res.r.componentes.anomalia_aquacrop, 3)} />
            )}
            <Dato k="× Rotación" v={res.r.componentes.efecto_rotacion.toFixed(2)} />
            {res.r.componentes.aptitud != null && (
              <Dato k="× Aptitud EcoCrop" v={res.r.componentes.aptitud.toFixed(2)} />
            )}
            {res.rc && (
              <Dato k="× Chunks (uso de suelo y pH vs. el punto)" v={res.rc.factor_parcela.toFixed(2)} />
            )}
            {res.r.referencia_aquacrop_t_ha != null && res.r.motor === 'balance_fao56' && (
              <Dato
                k="Apoyo AquaCrop (mismo escenario)"
                v={`${res.r.referencia_aquacrop_t_ha.toFixed(2)} t/ha`}
              />
            )}
            {res.r.siembra && <Dato k="Siembra" v={res.r.siembra} />}
            <div className="mt-2 space-y-1">
              {res.r.alerta_helada && (
                <p className="text-blue-800">
                  ❄ Riesgo de helada en {camp?.meses_riesgo_helada} mes(es) del ciclo.
                </p>
              )}
              {res.r.alerta_deficit && (
                <p className="text-amber-700">💧 Déficit hídrico: el agua limita el rendimiento.</p>
              )}
              {!res.r.alerta_helada && !res.r.alerta_deficit && (
                <p className="text-green-800">Sin alertas de helada ni déficit.</p>
              )}
            </div>
            {camp && feno && (
              <table className="mt-2 w-full text-2xs">
                <thead>
                  <tr className="text-ui-ink-muted">
                    <th className="text-left font-normal">Mes</th>
                    <th className="text-left font-normal">Fase</th>
                    <th className="text-right font-normal">Kc</th>
                    <th className="text-right font-normal">Ks (estrés)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(camp.mensual).map(([mes, m], i) => {
                    const dia = i * 30 + 15;
                    const fase =
                      feno.fases.find((f) => dia >= f.dia_ini && dia <= f.dia_fin) ??
                      feno.fases[feno.fases.length - 1];
                    return (
                      <tr key={mes}>
                        <td>{mes}</td>
                        <td className="truncate">{fase.fase}</td>
                        <td className="value text-right">{m.kc.toFixed(2)}</td>
                        <td
                          className={`value text-right ${m.ks < 0.7 ? 'text-ui-danger' : m.ks < 0.9 ? 'text-amber-700' : ''}`}
                        >
                          {m.ks.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-2xs text-ui-ink-muted">
              Motores: {Object.values(MOTOR_ETIQUETA).join(' · ')}.
            </p>
            <p className="text-2xs font-medium text-ui-accent">{ETIQUETA_SIMULACION}</p>
            <button
              className="btn btn-active mt-2 w-full justify-center"
              onClick={() => {
                const err = jc.abrirEn3D();
                if (err) useJuninStore.setState({ error: err });
              }}
            >
              Ver la parcela en 3D{' '}
              {s.cultivo && CULTIVO_SIMULADOR[s.cultivo] ? `y sembrar ${res.nombre.toLowerCase()}` : ''}
            </button>
            {s.cultivo && !CULTIVO_SIMULADOR[s.cultivo] && (
              <p className="mt-1 text-2xs text-ui-ink-muted">
                En 3D se pueden sembrar papa, maíz amiláceo, quinua, haba y avena forrajera.
              </p>
            )}
          </>
        )}
      </Paso>

      <Paso n={12} titulo="Rotación (2 campañas)" apagado={!res && !s.plan.length}>
        {res && (
          <button
            className="btn w-full justify-center"
            onClick={() =>
              jc.agregarARotacion(
                res.r,
                res.nombre,
                res.rc?.produccion_t ?? 0,
                res.rc?.rend_parcela_t_ha ?? res.r.rend_t_ha,
              )
            }
          >
            {s.campana === 0
              ? 'Guardar 2026-27 y elegir el cultivo de 2027-28'
              : 'Guardar la campaña 2027-28'}
          </button>
        )}
        {s.plan.length > 0 && (
          <>
            <table className="mt-2 w-full text-2xs">
              <tbody>
                {s.plan.map((p) => (
                  <tr key={p.campana}>
                    <td>{p.campana === 0 ? '2026-27' : '2027-28'}</td>
                    <td>
                      {p.nombre}
                      {p.anterior ? ` (después de ${p.anterior})` : ''}
                    </td>
                    <td className="value text-right">{p.rend_t_ha.toFixed(2)} t/ha</td>
                    <td className="value text-right">{p.produccion_t.toFixed(1)} t</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Dato k="Producción total" v={`${s.plan.reduce((a, p) => a + p.produccion_t, 0).toFixed(1)} t`} />
            <button className="btn mt-1" onClick={() => jc.reiniciarRotacion()}>
              Reiniciar rotación
            </button>
          </>
        )}
        <p className="mt-1 text-2xs text-ui-ink-muted">
          El cultivo guardado pasa a ser el «anterior» de la campaña siguiente (p. ej. papa después de haba ×
          1.1).
        </p>
      </Paso>
    </div>
  );
}
