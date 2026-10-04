/**
 * Pasos 8 a 12 de la parcela real, dentro del simulador 3D (fase «Cultivos» y «Cosecha»):
 * campaña y cultivo anterior, condiciones de plantación, motor de Junín y rotación.
 * El cultivo es el que se elige en el 3D: así el número que se ve aquí es el mismo que se cosecha.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { juninController as jc } from '@/controllers/JuninController';
import {
  CULTIVO_SIMULADOR,
  ESCENARIOS,
  ETIQUETA_SIMULACION,
  menuCultivos,
  type Severidad,
} from '@/domain/junin';
import { useJuninStore } from '@/store/juninStore';
import { useSimStore } from '@/store/useSimStore';
import { Section } from '../panels/Section';
import { useResultadoJunin, type ResultadoJunin } from './useJunin';

/** Nombre del cultivo en el 3D → id de Junín */
const ID_JUNIN = Object.fromEntries(Object.entries(CULTIVO_SIMULADOR).map(([id, nombre]) => [nombre, id]));

const Dato = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex justify-between gap-2 py-0.5 text-xs">
    <span className="text-ui-ink-muted">{k}</span>
    <span className="value text-right">{v}</span>
  </div>
);
const fmt = (x: number | null | undefined, d = 2) => (x == null ? '—' : x.toFixed(d));

const ICONO_SEV: Record<Severidad, string> = { bloqueo: '⛔', advertencia: '⚠', info: '▫' };
const COLOR_SEV: Record<Severidad, string> = {
  bloqueo: 'text-ui-danger',
  advertencia: 'text-amber-700',
  info: 'text-ui-ink-muted',
};
const ESTADO_SIEMBRA = {
  apta: ['bg-green-100 text-green-900', 'Apta para sembrar'],
  con_advertencias: ['bg-amber-100 text-amber-900', 'Apta, con advertencias'],
  no_apta: ['bg-red-100 text-red-900', 'No apta'],
} as const;
const ESC_CORTO = { normal: 'Normal', actual: 'Actual', neutro: 'Neutro', nino: 'El Niño', nina: 'La Niña' };

/** Paso 8b: condiciones de plantación con el dato usado en cada una */
function Condiciones({ res }: { res: ResultadoJunin }) {
  const ev = res.ev!;
  const [clase, titulo] = ESTADO_SIEMBRA[ev.estado];
  const m = ev.marco;
  return (
    <div className="text-xs">
      <div className={`mb-2 rounded px-2 py-1 font-semibold ${clase}`}>
        {titulo}: {res.nombre}
        <span className="ml-1 font-normal">
          · confianza {ev.confianza.nivel} ({ev.confianza.distancia_km} km al punto con datos)
        </span>
      </div>
      <ul className="space-y-1">
        {ev.razones.map((r) => (
          <li key={r.codigo} className={`text-2xs ${COLOR_SEV[r.severidad]}`} title={r.fuente ?? ''}>
            {ICONO_SEV[r.severidad]} {r.mensaje_es}
            <span className="block pl-4 text-ui-ink-muted">Dato: {r.dato_usado}</span>
          </li>
        ))}
      </ul>
      {ev.correccion.aplicada && ev.meses.length > 0 && (
        <table className="mt-2 w-full text-2xs">
          <thead className="text-ui-ink-muted">
            <tr>
              <th className="text-left font-normal">Mes</th>
              <th className="text-right font-normal">Tmín punto</th>
              <th className="text-right font-normal">Tmín parcela</th>
              <th className="text-right font-normal">Tmed parcela</th>
            </tr>
          </thead>
          <tbody>
            {ev.meses.map((x) => (
              <tr key={x.mes}>
                <td>{x.mes}</td>
                <td className="value text-right">{x.tmin_punto.toFixed(1)}</td>
                <td className="value text-right">{x.tmin_parcela.toFixed(1)}</td>
                <td className="value text-right">{x.tmed_parcela.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {m && (
        <div className="mt-2 rounded border border-ui-border p-2 text-2xs">
          <div className="font-semibold">Marco de plantación · {m.variedad}</div>
          {m.plantas_m2 != null ? (
            <p>
              {m.entre_surcos_m != null && `Surcos a ${m.entre_surcos_m} m`}
              {m.entre_plantas_m != null && `, golpes a ${m.entre_plantas_m} m`} →{' '}
              <b>{m.plantas_m2} plantas/m²</b> ({Math.round(m.plantas_m2 * 10_000).toLocaleString('es-PE')}
              /ha)
              {res.kg_planta != null && ` · ${res.kg_planta} kg por planta`}.
            </p>
          ) : (
            <p>
              Siembra {m.metodo}: {m.semilla_kg_ha ?? '—'} kg de semilla/ha; no se cuentan plantas.
            </p>
          )}
          <p className="mt-1 text-ui-ink-muted">Fuente: {m.fuente}</p>
        </div>
      )}
    </div>
  );
}

/** Pasos 9-11: una sola cifra de rendimiento (la que se cosecha en el 3D) y cómo se arma */
function Resultado({ res }: { res: ResultadoJunin }) {
  if (res.ev?.estado === 'no_apta')
    return (
      <div className="rounded bg-red-100 px-2 py-1 text-xs text-red-900">
        <p className="font-semibold">
          No se calcula el rendimiento: {res.nombre.toLowerCase()} no es apto aquí.
        </p>
        {res.ev.razones
          .filter((r) => r.severidad === 'bloqueo')
          .map((r) => (
            <p key={r.codigo} className="text-2xs">
              ⛔ {r.mensaje_es}
            </p>
          ))}
        <p className="mt-1 text-2xs">Si lo siembras, su cosecha será 0. Elige otro cultivo.</p>
      </div>
    );
  const c = res.r.componentes;
  const rc = res.rc;
  const aq = res.r.referencia_aquacrop_t_ha;
  return (
    <div className="text-xs">
      <div className="mb-2 grid grid-cols-2 gap-1 text-center">
        <div className="rounded bg-ui-panel-2 p-1.5">
          <div className="value text-base font-semibold">{fmt(rc?.rend_parcela_t_ha ?? res.rend_t_ha)}</div>
          <div className="text-2xs text-ui-ink-muted">t/ha en tu parcela (salud 100 %)</div>
        </div>
        <div className="rounded bg-ui-panel-2 p-1.5">
          <div className="value text-base font-semibold">{fmt(rc?.produccion_t, 1)}</div>
          <div className="text-2xs text-ui-ink-muted">t en {fmt(rc?.area_ha, 3)} ha útiles</div>
        </div>
      </div>
      <Dato k="Motor" v={res.r.motor_etiqueta} />
      <Dato k="Referencia DRA 2022" v={`${fmt(c.rend_ref_t_ha)} t/ha`} />
      {c.anomalia_balance != null && (
        <Dato
          k={`× Agua del escenario vs. normal (${fmt(c.factor_agua)} ÷ ${fmt(c.factor_agua_normal)})`}
          v={fmt(c.anomalia_balance)}
        />
      )}
      {res.r.motor === 'aquacrop' && <Dato k="× Anomalía AquaCrop" v={fmt(c.anomalia_aquacrop, 3)} />}
      <Dato k="× Rotación" v={fmt(c.efecto_rotacion)} />
      {c.aptitud != null && <Dato k="× Aptitud EcoCrop (fuera de su provincia)" v={fmt(c.aptitud)} />}
      {res.ev && res.ev.factor_helada < 1 && (
        <Dato k="× Helada (temperatura corregida por altura)" v={fmt(res.ev.factor_helada)} />
      )}
      {rc && <Dato k="× Chunks (uso de suelo y pH vs. el punto)" v={fmt(rc.factor_parcela)} />}
      {res.ev?.confianza.rango_t_ha && rc && res.ev.confianza.nivel !== 'alta' && (
        <Dato
          k={`Rango (confianza ${res.ev.confianza.nivel})`}
          v={`${fmt(res.ev.confianza.rango_t_ha[0] * (rc.rend_parcela_t_ha / (res.r.rend_t_ha || 1)))}–${fmt(res.ev.confianza.rango_t_ha[1] * (rc.rend_parcela_t_ha / (res.r.rend_t_ha || 1)))} t/ha`}
        />
      )}
      {res.ev?.marco?.plantas_m2 != null && rc && (
        <Dato
          k="Plantas en la parcela"
          v={`${Math.round(res.ev.marco.plantas_m2 * rc.area_ha * 10_000).toLocaleString('es-PE')} · ${fmt(res.kg_planta)} kg/planta`}
        />
      )}
      {res.r.siembra && <Dato k="Siembra" v={res.r.siembra} />}
      <p className="mt-1 text-2xs text-ui-ink-muted">
        En el 3D cada celda cosecha esta cifra × su salud × su área: si cuidas el agua y el suelo, llegas a
        ella; si no, cosechas menos.
      </p>
      {aq != null && res.r.motor === 'balance_fao56' && (
        <details className="mt-1 text-2xs text-ui-ink-muted">
          <summary className="cursor-pointer">
            Validación con AquaCrop: {fmt(aq)} t/ha (
            {res.rend_t_ha ? Math.round(((aq - res.rend_t_ha) / res.rend_t_ha) * 100) : 0} % frente al
            balance)
          </summary>
          <p className="mt-1">
            Los dos motores usan anomalías sobre el mismo dato DRA 2022: el balance compara el agua del
            escenario con la del clima normal (FAO-56) y AquaCrop su rendimiento simulado con su promedio
            2013-2022. Difieren porque AquaCrop además simula la biomasa con su propio cultivo de referencia;
            la cifra que se usa es la del balance, porque es la que sigue el agua del 3D.
          </p>
        </details>
      )}
      <p className="mt-1 text-2xs font-medium text-ui-accent">{ETIQUETA_SIMULACION}</p>
    </div>
  );
}

/** Pasos 8-11 en la fase «Cultivos» del 3D */
export function PanelCultivoJunin() {
  const cultivo3D = useSimStore((s) => s.cultivo);
  const s = useJuninStore(
    useShallow((st) => ({
      nucleo: st.nucleo,
      ubicacion: st.ubicacion,
      escenario: st.escenario,
      anterior: st.anterior,
      campana: st.campana,
    })),
  );
  const res = useResultadoJunin();
  const idJunin = cultivo3D ? (ID_JUNIN[cultivo3D] ?? null) : null;
  // el cultivo elegido en el 3D es el del motor de Junín
  useEffect(() => {
    jc.setCultivo(idJunin);
  }, [idJunin]);
  const menu = useMemo(
    () => (s.nucleo && s.ubicacion ? menuCultivos(s.ubicacion.punto, s.nucleo, true) : []),
    [s.nucleo, s.ubicacion],
  );
  if (!s.nucleo || !s.ubicacion) return null;

  return (
    <>
      <Section titulo={`8 · Campaña en ${s.ubicacion.punto} (parcela real)`}>
        <div className="mb-2 grid grid-cols-5 gap-1">
          {ESCENARIOS.map((e) => (
            <button
              key={e}
              className={`btn justify-center px-1 text-2xs ${s.escenario === e ? 'btn-active' : ''}`}
              onClick={() => jc.setEscenario(e)}
              title={s.nucleo!.sim.meta.escenarios[e]}
            >
              {ESC_CORTO[e]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
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
        </div>
        <p className="mt-1 text-2xs text-ui-ink-muted">
          Cambiar el escenario o la campaña cambia el clima del 3D y el rendimiento de referencia de cada
          celda.
        </p>
      </Section>
      {!res ? (
        <Section titulo="8b · Condiciones y rendimiento">
          <p className="text-2xs text-ui-ink-muted">
            Elige un cultivo arriba: aquí verás si se puede sembrar en esta parcela y cuánto rendiría.
          </p>
        </Section>
      ) : (
        <>
          {res.ev && (
            <Section titulo="8b · Condiciones de plantación">
              <Condiciones res={res} />
            </Section>
          )}
          <Section titulo="9-11 · Motor de Junín y rendimiento">
            <Resultado res={res} />
          </Section>
        </>
      )}
    </>
  );
}

/** Paso 12 · Rotación de dos campañas (en la fase «Cosecha» del 3D) */
export function RotacionJunin() {
  const plan = useJuninStore((s) => s.plan);
  const campana = useJuninStore((s) => s.campana);
  const res = useResultadoJunin();
  return (
    <Section titulo="12 · Rotación (2 campañas)">
      {res && res.ev?.estado !== 'no_apta' ? (
        <button
          className="btn w-full justify-center"
          onClick={() =>
            jc.agregarARotacion(
              res.r,
              res.nombre,
              res.rc?.produccion_t ?? 0,
              res.rc?.rend_parcela_t_ha ?? res.rend_t_ha,
            )
          }
        >
          {campana === 0
            ? `Guardar ${res.nombre} en 2026-27 y pasar a 2027-28`
            : `Guardar ${res.nombre} en 2027-28`}
        </button>
      ) : (
        <p className="text-2xs text-ui-ink-muted">
          Elige un cultivo apto en «Cultivos» para guardarlo en la rotación.
        </p>
      )}
      {plan.length > 0 && (
        <>
          <table className="mt-2 w-full text-2xs">
            <tbody>
              {plan.map((p) => (
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
          <Dato k="Producción total" v={`${plan.reduce((a, p) => a + p.produccion_t, 0).toFixed(1)} t`} />
          <button className="btn mt-1" onClick={() => jc.reiniciarRotacion()}>
            Reiniciar rotación
          </button>
        </>
      )}
    </Section>
  );
}
