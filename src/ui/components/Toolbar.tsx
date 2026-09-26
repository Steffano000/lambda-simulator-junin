/** Barra superior: overlay activo (paso 01) y tamaño de grilla (paso 03). */
import { useController } from '@/controllers/hooks';
import { SIZE_PRESETS, type SizePreset } from '@/domain/grid';
import { useSimStore, type Overlay } from '@/store/useSimStore';

const overlays: { id: Overlay; label: string }[] = [
  { id: 'suelo', label: 'Suelo' },
  { id: 'humedad', label: 'Humedad' },
  { id: 'ph', label: 'pH' },
];

const sizes: { id: SizePreset; label: string }[] = [
  { id: 'demo', label: 'Demo' },
  { id: 'parcela', label: 'Parcela' },
  { id: 'microcuenca', label: 'Microcuenca' },
];

export function Toolbar() {
  const controller = useController();
  const overlay = useSimStore((s) => s.overlay);
  const config = useSimStore((s) => s.config);

  return (
    <header className="z-toolbar flex h-toolbar items-center gap-4 border-b border-ui-border bg-ui-panel px-4">
      <h1 className="text-sm font-semibold tracking-tight">
        Lambda <span className="text-ui-ink-muted">Simulator</span>
      </h1>

      <div role="group" aria-label="Overlay" className="flex gap-1">
        {overlays.map((o) => (
          <button
            key={o.id}
            className={`btn ${overlay === o.id ? 'btn-active' : ''}`}
            aria-pressed={overlay === o.id}
            onClick={() => controller.setOverlay(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Tamaño de grilla" className="ml-auto flex items-center gap-1">
        {sizes.map((s) => {
          const active = config.rows === SIZE_PRESETS[s.id].rows && config.cols === SIZE_PRESETS[s.id].cols;
          return (
            <button
              key={s.id}
              className={`btn ${active ? 'btn-active' : ''}`}
              aria-pressed={active}
              onClick={() => controller.resizeGrid(s.id)}
            >
              {s.label}
              <span className="value opacity-70">
                {SIZE_PRESETS[s.id].rows}×{SIZE_PRESETS[s.id].cols}
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
