/** Modificadores globales del borrador: lluvia ×%, ET0 ×% y temperatura +Δ °C (deslizador + número). */
import { useControllers } from '@/controllers/hooks';
import { LIMITES_MODIFICADORES, type Modificadores } from '@/domain/climate';

interface Control {
  clave: keyof Modificadores;
  etiqueta: string;
  unidad: string;
  ayuda: (v: number) => string;
}

const CONTROLES: Control[] = [
  {
    clave: 'lluviaPct',
    etiqueta: 'Lluvia',
    unidad: '%',
    ayuda: (v) =>
      v === 100 ? 'Igual que la base' : v < 100 ? `${100 - v} % menos lluvia` : `${v - 100} % más lluvia`,
  },
  {
    clave: 'et0Pct',
    etiqueta: 'Evapotranspiración (ET0)',
    unidad: '%',
    ayuda: (v) =>
      v === 100 ? 'Igual que la base' : v < 100 ? `${100 - v} % menos demanda` : `${v - 100} % más demanda`,
  },
  {
    clave: 'deltaT',
    etiqueta: 'Temperatura (media y mínima)',
    unidad: '°C',
    ayuda: (v) => (v === 0 ? 'Igual que la base' : `${v > 0 ? '+' : ''}${v} °C en todos los meses`),
  },
];

export function ModifierControls({ valores }: { valores: Modificadores }) {
  const { climate } = useControllers();

  return (
    <div className="space-y-3">
      {CONTROLES.map((c) => {
        const { min, max, paso } = LIMITES_MODIFICADORES[c.clave];
        const v = valores[c.clave];
        const id = `mod-${c.clave}`;
        return (
          <div key={c.clave}>
            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor={id} className="text-xs font-medium">
                {c.etiqueta}
              </label>
              <span className="flex items-baseline gap-1">
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={paso}
                  value={v}
                  onChange={(e) => climate.setModificadores({ [c.clave]: Number(e.target.value) })}
                  className="value w-16 rounded-md border border-ui-border bg-ui-panel px-1.5 py-0.5 text-right"
                  aria-label={`${c.etiqueta} (${c.unidad})`}
                />
                <span className="text-2xs text-ui-ink-muted">{c.unidad}</span>
              </span>
            </div>
            <input
              id={id}
              type="range"
              min={min}
              max={max}
              step={paso}
              value={v}
              onChange={(e) => climate.setModificadores({ [c.clave]: Number(e.target.value) })}
              className="w-full accent-[var(--ui-accent)]"
            />
            <p className="text-2xs text-ui-ink-muted">{c.ayuda(v)}</p>
          </div>
        );
      })}
    </div>
  );
}
