/** Paso 02/04 · Cultivos a plantar: disponibilidad según mes y clima del escenario activo. */
import { container } from '@/app/container';
import { useController, useCropBlockers } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import { useSimStore } from '@/store/useSimStore';
import { Section } from './Section';

export function CropSelector() {
  const controller = useController();
  const cultivo = useSimStore((s) => s.cultivo);
  const bloqueos = useCropBlockers();

  return (
    <Section titulo="Cultivo a sembrar">
      <ul className="space-y-1" role="radiogroup" aria-label="Cultivo">
        {container.crops.all().map((crop) => {
          const motivos = bloqueos[crop.nombre] ?? [];
          const activo = cultivo === crop.nombre;
          const d = crop.datos;
          return (
            <li key={crop.nombre}>
              <button
                role="radio"
                aria-checked={activo}
                aria-label={crop.nombre}
                title={motivos.join('\n') || 'Se puede sembrar este mes'}
                onClick={() => controller.selectCrop(crop.nombre)}
                className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                  activo ? 'border-ui-accent bg-ui-panel-2' : 'border-transparent hover:bg-ui-panel-2'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{crop.nombre}</span>
                  {motivos.length === 0 ? (
                    <span className="rounded bg-chi-saludable/15 px-1.5 text-2xs text-chi-saludable">
                      En temporada
                    </span>
                  ) : (
                    <span className="rounded bg-chi-estresado/15 px-1.5 text-2xs text-ui-ink-muted">
                      Siembra en {MESES[d.mes_siembra - 1]}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-2xs text-ui-ink-muted">
                  {d.variedad} · {d.ciclo_dias} días · pH {d.ph_opt_min}–{d.ph_opt_max} ·{' '}
                  {d.rendimiento_junin_2025} t/ha
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
