/** Avance del tiempo simulado: hace crecer los cultivos hasta la etapa Final. */
import { useController, useMesActual } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import { useSimStore } from '@/store/useSimStore';
import { Section } from './Section';

const PASOS = [1, 7, 30] as const;

export function TimeControls() {
  const controller = useController();
  const dia = useSimStore((s) => s.dia);
  const mes = useMesActual();

  return (
    <Section titulo="Tiempo">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-ui-ink-muted">
          Día <span className="value text-ui-ink">{dia}</span>
        </span>
        <span className="text-xs font-medium">{MESES[mes - 1]}</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {PASOS.map((d) => (
          <button key={d} className="btn justify-center" onClick={() => controller.advance(d)}>
            +{d} {d === 1 ? 'día' : 'días'}
          </button>
        ))}
      </div>
    </Section>
  );
}
