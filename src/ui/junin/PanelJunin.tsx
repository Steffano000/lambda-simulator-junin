/**
 * Rama "decidir": la secuencia completa del piloto (pasos 1 a 12 de ARQUITECTURA_HIBRIDA.md).
 * Todos los números salen de los JSON locales validados en Junín.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { juninController as jc } from '@/controllers/JuninController';
import type { EscenarioId } from '@/data/junin/types';
import type { ResumenResolucion } from '@/domain/junin';
import { API_URL } from '@/data/junin/servidor';
import {
  climaEscenario,
  ESCENARIOS,
  ETIQUETA_SIMULACION,
  CAPAS,
  CAPAS_POR_CHUNK,
  opcionesTamano,
  type CapaDato,
  PENALIZACION_ADVERTENCIA,
  UMBRAL_COBERTURA_PCT,
} from '@/domain/junin';
import { useJuninStore, type BaseNasa, type CapaChunk, type OverlayNasa } from '@/store/juninStore';
import {
  BASES_HD,
  BASES_NASA,
  COLOR_ESTADO,
  COLOR_FIDELIDAD,
  COLOR_REGLA,
  ETIQUETA_CAPA,
  leyendaCapa,
  NOMBRE_BASE,
  OVERLAYS_NASA,
} from './colores';
import { GraficoEscenario } from './GraficoEscenario';
import { OrigenFrescura } from './OrigenFrescura';
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
const metros = (m: number | null) => (m == null ? 'vector' : m >= 1000 ? `${m / 1000} km` : `${m} m`);

/** Tabla «Resolución efectiva» (Fase 2): qué tan fino es cada dato frente al chunk */
function ResolucionEfectiva({ r }: { r: ResumenResolucion }) {
  const ocultas = new Set(['pendiente', 'ndvi']);
  return (
    <div className="mt-2 rounded border border-ui-border p-2">
      <div className="mb-1 flex justify-between gap-2 font-semibold">
        <span>Resolución efectiva</span>
        <span className="value">
          {metros(r.efectiva_m)} ({CAPAS[r.capa_efectiva].nombre.toLowerCase()})
        </span>
      </div>
      <table className="w-full text-2xs">
        <thead className="text-ui-ink-muted">
          <tr>
            <th className="text-left font-normal">Capa</th>
            <th className="text-right font-normal">Nativa</th>
            <th className="text-right font-normal">Usada</th>
            <th className="text-right font-normal">Fidelidad</th>
          </tr>
        </thead>
        <tbody>
          {r.filas
            .filter((f) => !ocultas.has(f.capa))
            .map((f) => (
              <tr key={f.capa} title={`${f.fuente} · ${f.uso}`}>
                <td>{f.nombre}</td>
                <td className="text-right">{metros(f.nativa_m)}</td>
                <td className="text-right">
                  {f.efectiva
                    .map((e) => `${metros(e.res_m)}${f.efectiva.length > 1 ? ` (${e.pct}%)` : ''}`)
                    .join(' · ')}
                </td>
                <td className="text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="swatch" style={{ background: COLOR_FIDELIDAD[f.dominante] }} />
                    {f.dominante}
                    {f.factor_max > 1 && f.dominante !== 'real' && f.capa !== 'clima' && ` ×${f.factor_max}`}
                  </span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {r.advertencias.map((a) => (
        <p
          key={a}
          className={`mt-1 text-2xs ${a.startsWith('Tus chunks') ? 'text-amber-700' : 'text-ui-ink-muted'}`}
        >
          {a.startsWith('Tus chunks') ? '⚠ ' : '▫ '}
          {a}
        </p>
      ))}
    </div>
  );
}

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
      casas: st.casas,
      celdaElegida: st.celdaElegida,
      limite: st.limite,
      resolucion: st.resolucion,
      capaFidelidad: st.capaFidelidad,
    })),
  );
  const res = useResultadoJunin();
  const [ejemplo, setEjemplo] = useState('huayao_igp');

  const n = s.nucleo;
  const u = s.ubicacion;
  const listo = !!(u && !u.fuera_de_junin && s.resumen?.puede_sembrar);

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
        {s.chunks && s.resumen && (
          <>
            <Dato k="Área exacta dentro de los chunks" v={`${fmt(s.resumen.area_total_ha, 3)} ha`} />
            <Dato
              k="Área efectiva (con datos, sin bloqueos)"
              v={`${fmt(s.resumen.area_efectiva_ha, 3)} ha`}
            />
            <Dato
              k="Chunks"
              v={`${s.resumen.n_dentro} de ${s.chunks.celda_m} m: ${s.resumen.n_con_dato} a 30 m · ${s.resumen.n_interpolado} a ~1 km · ${s.resumen.n_sin_dato} sin dato · ${s.resumen.n_bloqueado} bloqueados`}
            />
            <Dato k="Área no bloqueada con datos" v={`${s.resumen.pct_cubierto} %`} />
            <Dato
              k="Origen de los datos"
              v={
                s.chunks.origen === 'servidor'
                  ? 'Servidor (TIF a 30 m)'
                  : `${s.resumen.pct_30m}% a 30 m · resto a ~1 km`
              }
            />
            {s.resumen.sin_dato.map((m) => (
              <p key={m} className="text-2xs text-ui-ink-muted">
                ▫ {m}
              </p>
            ))}
            <label className="mt-2 flex items-center gap-2">
              <span className="text-ui-ink-muted">Tamaño de chunk</span>
              <select
                className="field"
                value={s.celdaElegida ?? 'auto'}
                onChange={(e) => void jc.setCelda(e.target.value === 'auto' ? null : Number(e.target.value))}
              >
                {opcionesTamano(s.anillo!, s.limite.maxLado).map((o) =>
                  o.recomendado ? (
                    <option key="auto" value="auto">
                      Automático: {o.celda_m} m ({o.columnas}×{o.filas}) · recomendado
                    </option>
                  ) : (
                    <option key={o.celda_m} value={o.celda_m}>
                      {o.celda_m} m ({o.columnas}×{o.filas} = {o.total.toLocaleString('es-PE')})
                    </option>
                  ),
                )}
              </select>
            </label>
            {s.limite.motivo && <p className="text-2xs text-amber-700">{s.limite.motivo}</p>}
            {s.resolucion && <ResolucionEfectiva r={s.resolucion} />}
            <details className="mt-1 text-2xs text-ui-ink-muted">
              <summary className="cursor-pointer">¿Por qué chunks de {s.chunks.celda_m} m?</summary>
              <p className="mt-1">
                El automático es el chunk más chico sin pasar de {s.limite.maxLado} × {s.limite.maxLado} (el
                límite del 3D en este equipo): 1 m si la parcela mide hasta {s.limite.maxLado} m de lado.
                Sirve para <b>dibujar</b>: seguir el borde, medir el área exacta y ubicar surcos (1 m = un
                surco de papa, 0.9-1.0 m; INIA).
              </p>
              <p className="mt-1">
                Para <b>calcular</b>, lo más fino que existe es 30 m (uso de suelo); el relieve es de 90 m, el
                suelo de 250 m y el clima de ~10 km. Un chunk más chico que su dato es «remuestreado»: hereda
                el valor del píxel que lo contiene, y sus vecinos tienen el mismo. Mira la capa «Fidelidad» en
                el paso 6.
              </p>
              <p className="mt-1">
                Elige 30 m si quieres que cada chunk tenga su propio dato de uso de suelo; elige el automático
                si quieres ver la forma y el surco. El área y el rendimiento total no cambian con el tamaño
                (se mide la fracción exacta de cada chunk dentro del polígono).
              </p>
            </details>
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
                ? `Se puede sembrar en ${fmt(s.resumen.area_efectiva_ha, 3)} ha`
                : s.resumen.pct.bloqueado > 50
                  ? `No se puede sembrar: ${s.resumen.pct.bloqueado} % está bloqueado (ciudad, casas, agua, nieve o área protegida)`
                  : `Datos insuficientes: solo ${s.resumen.pct_cubierto} % del área no bloqueada tiene datos (mínimo ${UMBRAL_COBERTURA_PCT} %). No se da un rendimiento.`}
            </div>
            <div className="mb-1 flex h-2 overflow-hidden rounded">
              {(
                [
                  ['permitido', COLOR_REGLA.permitido],
                  ['advertencia', COLOR_REGLA.advertencia],
                  ['bloqueado', COLOR_REGLA.bloqueado],
                  ['sin_dato', COLOR_ESTADO.sin_dato],
                ] as const
              ).map(([k, color]) => (
                <div
                  key={k}
                  style={{ width: `${s.resumen!.pct[k]}%`, background: color }}
                  title={`${k} ${s.resumen!.pct[k]}%`}
                />
              ))}
            </div>
            <div className="mb-1 text-2xs text-ui-ink-muted">
              Permitido {s.resumen.pct.permitido}% · advertencia {s.resumen.pct.advertencia}% · bloqueado{' '}
              {s.resumen.pct.bloqueado}% · sin dato {s.resumen.pct.sin_dato}%
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
            {s.casas && (
              <p
                className={`text-2xs ${s.casas.estado === 'ok' && !s.casas.respaldo ? 'text-ui-ink-muted' : 'font-semibold text-amber-700'}`}
              >
                🏠 Casas ({s.casas.fuente}, {s.casas.respaldo ? 'copia guardada' : 'en vivo'}):{' '}
                {s.casas.mensaje}
              </p>
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
            {s.capaChunk === 'fidelidad' && (
              <div className="mb-2 flex flex-wrap items-center gap-1">
                <span className="text-2xs text-ui-ink-muted">De:</span>
                {(['peor', ...CAPAS_POR_CHUNK, 'clima'] as (CapaDato | 'peor')[]).map((k) => (
                  <button
                    key={k}
                    className={`btn px-2 py-0.5 text-2xs ${s.capaFidelidad === k ? 'btn-active' : ''}`}
                    onClick={() => jc.setCapaFidelidad(k)}
                  >
                    {k === 'peor' ? 'La más baja' : CAPAS[k].nombre}
                  </button>
                ))}
              </div>
            )}
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

      <Paso n="8-12" titulo="Cultivo, rendimiento y rotación → en el 3D" apagado={!listo}>
        {s.resumen && u && !u.fuera_de_junin && !s.resumen.puede_sembrar && (
          <p className="text-ui-danger">
            La simulación no corre en esta parcela (ver el paso 4). Dibuja otra o ajusta el polígono.
          </p>
        )}
        {listo && (
          <>
            <p className="mb-2 text-2xs text-ui-ink-muted">
              El cultivo, sus condiciones de plantación, el rendimiento del motor de Junín y la rotación se
              eligen en el simulador 3D: así la cifra que ves es la misma que cosechas. En 3D se siembran
              papa, maíz amiláceo, quinua, haba y avena forrajera (los cultivos con datos de fenología y
              balance hídrico).
            </p>
            <button
              className="btn btn-active w-full justify-center"
              onClick={() => {
                const err = jc.abrirEn3D();
                if (err) useJuninStore.setState({ error: err });
              }}
            >
              Abrir la parcela en 3D
            </button>
          </>
        )}
      </Paso>
      <Paso n="ⓘ" titulo="Origen y frescura de los datos">
        <OrigenFrescura />
      </Paso>
    </div>
  );
}
