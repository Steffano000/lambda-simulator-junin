/**
 * Panel único de contexto ambiental: escenario, tiempo de hoy (nubes, lluvia, validación),
 * condiciones del mes, estado hídrico del terreno con su efecto en las plantas y lo que
 * cambió en el último avance de tiempo.
 */
import type { ReactNode } from 'react';
import { container } from '@/app/container';
import { useClima } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import type { StressId } from '@/domain/stress';
import { useSimStore } from '@/store/useSimStore';
import { ScenarioPicker } from '../climate/ScenarioPicker';
import { VARIABLE_CLIMA } from '../icons';
import { HydrationSummary } from './environment/HydrationSummary';
import { WeatherNow } from './environment/WeatherNow';
import { Section } from './Section';

const ESTRES: Record<StressId, string> = {
  hidrico: 'déficit hídrico',
  helada: 'helada',
  termico: 'estrés térmico',
  exceso: 'exceso de humedad',
  anegamiento: 'encharcamiento',
};

const TONO = {
  favorable: 'border-chi-saludable/50 text-chi-saludable',
  riesgo: 'border-chi-estresado/60 text-chi-estresado',
  neutral: 'border-ui-border text-ui-ink-muted',
} as const;

function Subtitulo({ children }: { children: ReactNode }) {
  return <h3 className="mt-3 mb-1 text-2xs font-semibold text-ui-ink">{children}</h3>;
}

const mm = (v: number) => `${v.toFixed(1)} mm`;

export function EnvironmentPanel() {
  const escenario = useSimStore((s) => s.escenario);
  const avance = useSimStore((s) => s.ultimoAvance);
  const { mes, mensual, modificadores } = useClima();

  return (
    <Section titulo="Contexto ambiental">
      <ScenarioPicker />
      {container.scenarios.existe(escenario) && container.scenarios.create(escenario).personalizado && (
        <p className="mt-1 text-2xs text-ui-ink-muted">Escenario personalizado (sandbox climático).</p>
      )}

      <Subtitulo>Tiempo de hoy</Subtitulo>
      <WeatherNow />

      <Subtitulo>
        Mes de {MESES[mes - 1]} · {mensual.lluvia} mm de lluvia · ET0 {mensual.et0} mm
      </Subtitulo>
      <ul className="space-y-1">
        {modificadores.map((m) => (
          <li
            key={m.titulo}
            className={`rounded-md border-l-2 bg-ui-panel-2 px-2 py-1 text-2xs ${TONO[m.tipo]}`}
          >
            <div className="font-medium">{m.titulo}</div>
            <div className="text-ui-ink-muted">{m.detalle}</div>
          </li>
        ))}
      </ul>

      <Subtitulo>Estado hídrico del terreno</Subtitulo>
      <HydrationSummary />

      {avance && (
        <>
          <Subtitulo>
            Último avance · día {avance.desde} → {avance.hasta}
          </Subtitulo>
          <ul className="space-y-0.5 text-2xs text-ui-ink-muted">
            <li>
              Lluvia <span className="value text-ui-ink">{avance.lluviaMm.toFixed(0)} mm</span> en{' '}
              {avance.eventos.length} día(s) · ET0{' '}
              <span className="value text-ui-ink">{avance.et0Mm.toFixed(0)} mm</span>
            </li>
            <li>
              Por celda: infiltró <span className="value text-ui-ink">{mm(avance.infiltradoMm)}</span>,
              escurrió <span className="value text-ui-ink">{mm(avance.escorrentiaMm)}</span>, drenó{' '}
              <span className="value text-ui-ink">{mm(avance.drenadoMm)}</span>
            </li>
            <li>
              Evaporó <span className="value text-ui-ink">{mm(avance.evaporadoMm)}</span> · transpiraron los
              cultivos <span className="value text-ui-ink">{mm(avance.transpiradoMm)}</span>
            </li>
            <li>
              Humedad media del suelo{' '}
              <span className="value text-ui-ink">
                {avance.humedadAntes.toFixed(0)} → {avance.humedadDespues.toFixed(0)} %
              </span>
            </li>
            {avance.saludAntes !== null && avance.saludDespues !== null && (
              <li>
                Salud media de cultivos{' '}
                <span className="value text-ui-ink">
                  {avance.saludAntes.toFixed(0)} → {avance.saludDespues.toFixed(0)}
                </span>
              </li>
            )}
            {(Object.entries(avance.estres) as [StressId, number][]).map(([id, n]) => (
              <li key={id} className="flex items-center gap-1.5 text-chi-estresado">
                {id === 'hidrico' && <VARIABLE_CLIMA.deficit className="shrink-0 text-xs" />}
                {ESTRES[id]}: {n} día(s)-celda
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
