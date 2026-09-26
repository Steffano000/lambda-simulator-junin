/**
 * Panel único de contexto ambiental: escenario, condiciones del mes, modificadores,
 * efectos sobre los cultivos plantados y cambios del último avance de tiempo.
 */
import { container } from '@/app/container';
import { useClima, useControllers } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import type { StressId } from '@/domain/stress';
import { useSimStore } from '@/store/useSimStore';
import { Section } from './Section';

const ESTRES: Record<StressId, string> = {
  hidrico: 'déficit hídrico',
  helada: 'helada',
  termico: 'estrés térmico',
  anegamiento: 'anegamiento',
};

const TONO = {
  favorable: 'border-chi-saludable/50 text-chi-saludable',
  riesgo: 'border-chi-estresado/60 text-chi-estresado',
  neutral: 'border-ui-border text-ui-ink-muted',
} as const;

function Dato({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md bg-ui-panel-2 px-2 py-1.5">
      <div className="text-2xs text-ui-ink-muted">{label}</div>
      <div className="value text-ui-ink">
        {value} <span className="text-ui-ink-muted">{unit}</span>
      </div>
    </div>
  );
}

export function EnvironmentPanel() {
  const { time } = useControllers();
  const escenario = useSimStore((s) => s.escenario);
  const avance = useSimStore((s) => s.ultimoAvance);
  const hayPlantas = useSimStore((s) => s.plantaciones.length > 0);
  const { mes, mensual, diario, modificadores } = useClima();

  return (
    <Section titulo="Contexto ambiental">
      <select
        className="field mb-2"
        value={escenario}
        onChange={(e) => time.selectScenario(e.target.value)}
        aria-label="Escenario climático"
      >
        {container.scenarios.all().map((e) => (
          <option key={e.nombre} value={e.nombre}>
            {e.nombre} · {Math.round(e.lluviaAnual)} mm/año
          </option>
        ))}
      </select>

      <p className="mb-1.5 text-2xs text-ui-ink-muted">
        Condiciones de <strong className="text-ui-ink">{MESES[mes - 1]}</strong>
      </p>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        <Dato label="Lluvia" value={diario.lluvia.toFixed(1)} unit="mm/día" />
        <Dato label="ET0" value={diario.et0.toFixed(1)} unit="mm/día" />
        <Dato label="T media" value={mensual.tmed.toFixed(1)} unit="°C" />
        <Dato label="T mínima" value={mensual.tmin.toFixed(1)} unit="°C" />
      </div>

      <h3 className="mb-1 text-2xs font-semibold text-ui-ink">Modificadores del mes</h3>
      <ul className="mb-3 space-y-1">
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

      {avance && (
        <>
          <h3 className="mb-1 text-2xs font-semibold text-ui-ink">
            Último avance · día {avance.desde} → {avance.hasta}
          </h3>
          <ul className="space-y-0.5 text-2xs text-ui-ink-muted">
            <li>
              Lluvia <span className="value text-ui-ink">{avance.lluviaMm.toFixed(0)} mm</span> · ET0{' '}
              <span className="value text-ui-ink">{avance.et0Mm.toFixed(0)} mm</span>
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
              <li key={id} className="text-chi-estresado">
                {ESTRES[id]}: {n} día(s)-celda
              </li>
            ))}
          </ul>
        </>
      )}
      {!avance && hayPlantas && (
        <p className="text-2xs text-ui-ink-muted">
          Avanza el tiempo para ver cómo el ambiente afecta a los cultivos.
        </p>
      )}
    </Section>
  );
}
