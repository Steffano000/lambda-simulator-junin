/**
 * Control del tiempo (sección independiente): saltos predefinidos con iconos y un
 * control central para personalizar la cantidad de días (− / valor / + / avanzar).
 */
import type { ComponentType } from 'react';
import { useControllers, useMesActual } from '@/controllers/hooks';
import { PASO_LIMITES } from '@/controllers/TimeController';
import { MESES } from '@/domain/crops';
import { useSimStore } from '@/store/useSimStore';
import { IconFortnight, IconMinus, IconMonth, IconPlay, IconPlus, IconSun, IconWeek } from './icons';

const SALTOS: { dias: number; Icon: ComponentType<{ className?: string }> }[] = [
  { dias: 1, Icon: IconSun },
  { dias: 7, Icon: IconWeek },
  { dias: 15, Icon: IconFortnight },
  { dias: 30, Icon: IconMonth },
];

export function TimeBar() {
  const { time } = useControllers();
  const terreno = useSimStore((s) => s.terreno);
  const dia = useSimStore((s) => s.dia);
  const paso = useSimStore((s) => s.pasoDias);
  const mes = useMesActual();
  if (!terreno) return null;

  return (
    <section
      aria-label="Control del tiempo"
      className="panel absolute bottom-4 left-1/2 z-hud flex -translate-x-1/2 items-center gap-3 px-3 py-2"
    >
      <div className="pr-1 text-center leading-tight">
        <div className="value text-sm font-semibold">Día {dia}</div>
        <div className="text-2xs text-ui-ink-muted">{MESES[mes - 1]}</div>
      </div>

      <div role="group" aria-label="Saltos predefinidos" className="flex gap-1">
        {SALTOS.map(({ dias, Icon }) => (
          <button
            key={dias}
            className="btn flex-col gap-0 px-2 py-1"
            onClick={() => time.advance(dias)}
            title={`Avanzar ${dias} ${dias === 1 ? 'día' : 'días'}`}
          >
            <Icon className="text-base" />
            <span className="text-2xs">+{dias}</span>
          </button>
        ))}
      </div>

      <div
        role="group"
        aria-label="Salto personalizado"
        className="flex items-center gap-1 rounded-lg border border-ui-accent/60 bg-ui-panel-2 p-1"
      >
        <button className="btn px-1.5" onClick={() => time.incPaso(-1)} aria-label="Reducir días">
          <IconMinus />
        </button>
        <label className="flex items-baseline gap-1">
          <input
            type="number"
            min={PASO_LIMITES.min}
            max={PASO_LIMITES.max}
            value={paso}
            onChange={(e) => time.setPaso(Number(e.target.value))}
            className="value w-14 rounded-md border border-ui-border bg-ui-panel px-1.5 py-1 text-center text-sm"
            aria-label="Días a avanzar"
          />
          <span className="text-2xs text-ui-ink-muted">días</span>
        </label>
        <button className="btn px-1.5" onClick={() => time.incPaso(1)} aria-label="Aumentar días">
          <IconPlus />
        </button>
        <button className="btn btn-active" onClick={() => time.advance()} title={`Avanzar ${paso} días`}>
          <IconPlay /> Avanzar
        </button>
      </div>
    </section>
  );
}
