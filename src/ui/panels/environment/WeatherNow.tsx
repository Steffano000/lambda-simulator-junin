/**
 * Tiempo de hoy: estado del cielo, nubes, lluvia (intensidad, duración, cantidad),
 * temperatura, humedad ambiental y la validación meteorológica paso a paso.
 * El estado visual del cielo es el mismo que tiñe el fondo de la escena: aquí va su
 * etiqueta, porque el color nunca es el único canal (design.md §2).
 */
import { useCieloVisual, useClimaHoy } from '@/controllers/hooks';
import { ETIQUETA_INTENSIDAD } from '@/domain/climate';
import { VARIABLE_CLIMA, type Icono } from '../../icons';
import { IconCheck, IconClose, IconCloud, IconRain, IconSun } from '../../components/icons';

const CIELO = {
  despejado: { etiqueta: 'Despejado', Icono: IconSun },
  nublado: { etiqueta: 'Nublado', Icono: IconCloud },
  lluvia: { etiqueta: 'Lluvia', Icono: IconRain },
} as const;

function Dato({ label, value, Icono }: { label: string; value: string; Icono?: Icono }) {
  return (
    <div className="rounded-md bg-ui-panel-2 px-2 py-1">
      <div className="flex items-center gap-1 text-2xs text-ui-ink-muted">
        {Icono && <Icono className="shrink-0 text-xs" />}
        {label}
      </div>
      <div className="value text-xs text-ui-ink">{value}</div>
    </div>
  );
}

export function WeatherNow() {
  const hoy = useClimaHoy();
  const { etiqueta: cielo, estado } = useCieloVisual();
  const { etiqueta, Icono } = CIELO[hoy.cielo];
  const lluvia = hoy.lluvia;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icono className={`text-2xl ${hoy.cielo === 'despejado' ? 'text-etapa-final' : 'text-serie-agua'}`} />
        <div>
          <div className="text-sm font-semibold">
            {etiqueta}
            {lluvia && ` · ${ETIQUETA_INTENSIDAD[lluvia.intensidad].toLowerCase()}`}
          </div>
          <div className="text-2xs text-ui-ink-muted">
            Día {hoy.dia} · {hoy.nubes ? 'con nubes' : 'sin nubes'}
            {lluvia?.tipo === 'granizo' && ' · posible granizo'}
          </div>
        </div>
      </div>

      {cielo !== etiqueta && (
        <p className="mb-2 rounded-md border-l-2 border-ui-border bg-ui-panel-2 px-2 py-1 text-2xs text-ui-ink-muted">
          Cielo de la escena: <span className="text-ui-ink">{cielo}</span> ({estado}).
        </p>
      )}

      <div className="mb-2 grid grid-cols-2 gap-1">
        <Dato label="T media" value={`${hoy.tmed} °C`} Icono={VARIABLE_CLIMA.tmed} />
        <Dato label="T mínima" value={`${hoy.tmin} °C`} Icono={VARIABLE_CLIMA.tmin} />
        <Dato label="ET0" value={`${hoy.et0.toFixed(1)} mm`} Icono={VARIABLE_CLIMA.et} />
        <Dato label="HR (estim.)" value={`${hoy.hr} %`} />
        <Dato label="Prob. lluvia" value={`${Math.round(hoy.probabilidad * 100)} %`} />
        <Dato
          label="Precipitación"
          value={lluvia ? `${lluvia.mm} mm` : '0 mm'}
          Icono={VARIABLE_CLIMA.lluvia}
        />
        <Dato label="Duración" value={lluvia ? `${lluvia.duracionH} h` : '—'} />
      </div>
      {lluvia && (
        <p className="mb-2 rounded-md border-l-2 border-serie-agua bg-ui-panel-2 px-2 py-1 text-2xs text-ui-ink-muted">
          Lluvia activa de {lluvia.intensidadMmH} mm/h durante {lluvia.duracionH} h. Entra al terreno al
          avanzar el día: primero la absorbe el suelo; lo que no, se acumula en surcos o escurre.
        </p>
      )}

      <details className="text-2xs">
        <summary className="cursor-pointer text-ui-ink-muted">Validación meteorológica</summary>
        <ul className="mt-1 space-y-0.5">
          {hoy.validaciones.map((v) => (
            <li key={v.etiqueta} className="flex items-start gap-1.5">
              {v.ok ? (
                <IconCheck className="mt-0.5 shrink-0 text-chi-saludable" />
              ) : (
                <IconClose className="mt-0.5 shrink-0 text-ui-ink-muted" />
              )}
              <span>
                <span className="font-medium text-ui-ink">{v.etiqueta}:</span>{' '}
                <span className="text-ui-ink-muted">{v.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
