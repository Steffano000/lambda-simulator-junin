/** Bitácora de cosechas (rendimiento de referencia hasta implementar el factor hídrico del paso 04). */
import { useSimStore } from '@/store/useSimStore';
import { Section } from './Section';

export function HarvestLog() {
  const cosechas = useSimStore((s) => s.cosechas);
  if (cosechas.length === 0) return null;

  const total = cosechas.reduce((acc, c) => acc + c.kg, 0);

  return (
    <Section titulo={`Cosechas (${cosechas.length})`}>
      <p className="mb-2 text-xs">
        Total <span className="value font-semibold">{total.toFixed(2)} kg</span>
        <span className="ml-1 text-2xs text-ui-ink-muted">(rend. ref. Junín 2025)</span>
      </p>
      <ul className="max-h-32 space-y-0.5 overflow-y-auto">
        {cosechas.map((c, i) => (
          <li key={`${c.tileId}-${c.dia}-${i}`} className="flex justify-between text-2xs text-ui-ink-muted">
            <span>
              {c.cultivo} · celda <span className="value">{c.tileId}</span>
            </span>
            <span className="value">
              día {c.dia} · {c.kg} kg
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
