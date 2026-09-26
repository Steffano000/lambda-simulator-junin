/** Barra superior: flujo de trabajo y overlay activo de la grilla. */
import { useControllers } from '@/controllers/hooks';
import { useSimStore, type Overlay } from '@/store/useSimStore';
import { FlowStepper } from './FlowStepper';

const overlays: { id: Overlay; label: string }[] = [
  { id: 'suelo', label: 'Suelo' },
  { id: 'humedad', label: 'Humedad' },
  { id: 'ph', label: 'pH' },
  { id: 'salud', label: 'Salud' },
];

export function Toolbar() {
  const { selection } = useControllers();
  const overlay = useSimStore((s) => s.overlay);

  return (
    <header className="z-toolbar flex h-toolbar items-center gap-6 border-b border-ui-border bg-ui-panel px-4">
      <h1 className="text-sm font-semibold tracking-tight">
        Lambda <span className="text-ui-ink-muted">Simulator</span>
      </h1>

      <FlowStepper />

      <div role="group" aria-label="Capa de color" className="ml-auto flex items-center gap-1">
        <span className="mr-1 text-2xs text-ui-ink-muted">Capa</span>
        {overlays.map((o) => (
          <button
            key={o.id}
            className={`btn ${overlay === o.id ? 'btn-active' : ''}`}
            aria-pressed={overlay === o.id}
            onClick={() => selection.setOverlay(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </header>
  );
}
