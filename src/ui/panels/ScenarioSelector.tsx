/** Paso 05 · Selector de escenario climático + mes de inicio y clima del mes actual. */
import { container } from '@/app/container';
import { useClimaActual, useController, useMesActual } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import { useSimStore } from '@/store/useSimStore';
import { Section } from './Section';

function Dato({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-md bg-ui-panel-2 px-2 py-1.5">
      <div className="text-2xs text-ui-ink-muted">{label}</div>
      <div className="value text-ui-ink">
        {value.toFixed(1)} <span className="text-ui-ink-muted">{unit}</span>
      </div>
    </div>
  );
}

export function ScenarioSelector() {
  const controller = useController();
  const escenario = useSimStore((s) => s.escenario);
  const mesInicio = useSimStore((s) => s.mesInicio);
  const mes = useMesActual();
  const clima = useClimaActual();
  const escenarios = container.scenarios.all();

  return (
    <Section titulo="Escenario climático">
      <label className="block">
        <span className="sr-only">Escenario</span>
        <select
          className="field"
          value={escenario}
          onChange={(e) => controller.selectScenario(e.target.value)}
        >
          {escenarios.map((e) => (
            <option key={e.nombre} value={e.nombre}>
              {e.nombre} · {Math.round(e.lluviaAnual)} mm/año
            </option>
          ))}
        </select>
      </label>

      <label className="mt-2 flex items-center justify-between gap-2 text-xs text-ui-ink-muted">
        Mes de inicio
        <select
          className="field w-24"
          value={mesInicio}
          onChange={(e) => controller.setMesInicio(Number(e.target.value))}
        >
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-3 mb-1.5 text-2xs text-ui-ink-muted">
        Clima de <strong className="text-ui-ink">{MESES[mes - 1]}</strong> en este escenario
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Dato label="Lluvia" value={clima.lluvia} unit="mm" />
        <Dato label="ET0" value={clima.et0} unit="mm" />
        <Dato label="T media" value={clima.tmed} unit="°C" />
        <Dato label="T mínima" value={clima.tmin} unit="°C" />
      </div>
    </Section>
  );
}
