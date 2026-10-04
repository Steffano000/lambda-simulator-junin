/**
 * Fase 6 · «Origen y frescura»: de dónde sale cada dato, de qué fecha es, cómo se actualiza y
 * cómo terminó su última consulta. Con el botón «Actualizar datos» y el registro de consultas.
 */
import { useState } from 'react';
import { juninController as jc } from '@/controllers/JuninController';
import { ETIQUETA_MODO, FUENTES, esFresca } from '@/data/fuentes';
import { ultimaPorFuente, useRegistro, type EstadoConsulta } from '@/data/registro';
import { API_URL } from '@/data/junin/servidor';
import { useJuninStore } from '@/store/juninStore';

const COLOR: Record<EstadoConsulta, string> = {
  ok: 'text-green-700',
  error: 'text-ui-danger',
  respaldo: 'text-amber-700',
  omitido: 'text-ui-ink-muted',
};
const ETIQUETA: Record<EstadoConsulta, string> = {
  ok: 'ok',
  error: 'falló',
  respaldo: 'copia vieja',
  omitido: 'omitido',
};

/** Fecha y hora LOCAL (las consultas se guardan en UTC) en formato AAAA-MM-DD hh:mm */
const fecha = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}`);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function OrigenFrescura() {
  const consultas = useRegistro((s) => s.consultas);
  const frescura = useJuninStore((s) => s.frescura);
  const cargando = useJuninStore((s) => s.cargando);
  const [verRegistro, setVerRegistro] = useState(false);
  const ultima = ultimaPorFuente(consultas);

  return (
    <div className="text-xs">
      <div className="mb-2 grid grid-cols-2 gap-x-2 text-2xs">
        <span className="text-ui-ink-muted">Datos locales generados</span>
        <span className="value text-right">{fecha(frescura.generado)}</span>
        <span className="text-ui-ink-muted">Clima observado hasta</span>
        <span className="value text-right">{frescura.ultimo_mes_observado ?? '—'} (luego, pronóstico)</span>
        <span className="text-ui-ink-muted">Cargados en esta sesión</span>
        <span className="value text-right">{fecha(frescura.cargado)}</span>
      </div>
      <table className="w-full text-2xs">
        <thead className="text-ui-ink-muted">
          <tr>
            <th className="text-left font-normal">Fuente</th>
            <th className="text-left font-normal">Modo</th>
            <th className="text-right font-normal">Dato de</th>
            <th className="text-right font-normal">Última consulta</th>
          </tr>
        </thead>
        <tbody>
          {FUENTES.filter((f) => f.modo !== 'opcional' || API_URL).map((f) => {
            // las fuentes locales llegan en los archivos de la app: su estado es el de esa carga
            const u = ultima.get(f.id) ?? (f.modo === 'local' ? ultima.get('datos_locales') : undefined);
            const descarga = f.script ? frescura.descargas[f.script] : null;
            // vencida respecto de la última consulta registrada (la hora de la consulta más reciente)
            const vieja =
              u &&
              f.ttl_h != null &&
              !esFresca(u.cuando, f.ttl_h, Date.parse(consultas[0]?.cuando ?? u.cuando));
            return (
              <tr
                key={f.id}
                className="align-top"
                title={`${f.proveedor} · ${f.uso} · se actualiza: ${f.actualizacion}`}
              >
                <td className="py-0.5 pr-1">
                  {f.nombre}
                  <span className="block text-ui-ink-muted">{f.proveedor}</span>
                </td>
                <td className="py-0.5 pr-1">
                  {ETIQUETA_MODO[f.modo]}
                  {f.ttl_h != null && <span className="block text-ui-ink-muted">caduca en {f.ttl_h} h</span>}
                </td>
                <td className="value py-0.5 text-right">
                  {descarga
                    ? fecha(descarga).slice(0, 10)
                    : f.modo === 'local'
                      ? fecha(frescura.generado).slice(0, 10)
                      : 'del día'}
                </td>
                <td className="py-0.5 text-right">
                  {u ? (
                    <>
                      <span className={COLOR[u.estado]}>{ETIQUETA[u.estado]}</span>
                      <span className="block text-ui-ink-muted">
                        {fecha(u.cuando).slice(11)}
                        {vieja && ' · vencida'}
                      </span>
                    </>
                  ) : (
                    <span className="text-ui-ink-muted">sin consultar</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        className="btn btn-active mt-2 w-full justify-center"
        disabled={!!cargando}
        onClick={() => void jc.actualizarDatos()}
        title="Vuelve a pedir los datos locales, vuelve a consultar las casas en OpenStreetMap y rearma la parcela"
      >
        Actualizar datos
      </button>
      <p className="mt-1 text-2xs text-ui-ink-muted">
        Los datos locales cambian solo cuando se vuelve a correr el pipeline (pipeline/codigos). Las casas se
        guardan 24 h en este navegador; si OpenStreetMap no responde se usa la última copia y se avisa.
      </p>
      <button
        className="mt-1 text-2xs text-ui-ink-muted underline"
        onClick={() => setVerRegistro(!verRegistro)}
      >
        {verRegistro ? 'Ocultar' : 'Ver'} registro de consultas ({consultas.length})
      </button>
      {verRegistro && (
        <ul className="mt-1 max-h-48 space-y-0.5 overflow-auto text-2xs">
          {consultas.slice(0, 50).map((c, i) => (
            <li key={i} className="flex gap-1">
              <span className="text-ui-ink-muted">{fecha(c.cuando).slice(11)}</span>
              <span className={COLOR[c.estado]}>{ETIQUETA[c.estado]}</span>
              <span className="truncate" title={`${c.recurso}${c.mensaje ? ` · ${c.mensaje}` : ''}`}>
                {c.fuente} · {c.recurso}
                {c.ms != null && ` · ${c.ms} ms`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
