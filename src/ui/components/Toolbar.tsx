/** Barra superior: flujo de trabajo y overlay activo de la grilla. */
import { useControllers } from '@/controllers/hooks';
import { useSimStore, type Overlay } from '@/store/useSimStore';
import { ModoSwitch } from '../junin/ModoSwitch';
import { FlowStepper } from './FlowStepper';
import { IconDrop } from './icons';

const overlays: { id: Overlay; label: string }[] = [
  { id: 'suelo', label: 'Suelo' },
  { id: 'humedad', label: 'Humedad' },
  { id: 'ph', label: 'pH' },
  { id: 'salud', label: 'Salud' },
];

export function Toolbar() {
  const { selection, climate } = useControllers();
  const overlay = useSimStore((s) => s.overlay);
  const escenario = useSimStore((s) => s.escenario);
  // «Fidelidad» solo tiene sentido con una parcela real de Junín
  const conFidelidad = useSimStore((s) => s.tiles.some((t) => t.fidelidad));
  const visibles = conFidelidad
    ? [...overlays, { id: 'fidelidad' as Overlay, label: 'Fidelidad' }]
    : overlays;

  return (
    <header className="z-toolbar flex h-toolbar items-center gap-6 border-b border-ui-border bg-ui-panel px-4">
      <h1 className="text-sm font-semibold tracking-tight">
        Lambda <span className="text-ui-ink-muted">Simulator</span>
      </h1>

      <ModoSwitch />

      <FlowStepper />

      <button
        className="btn ml-auto max-w-72"
        onClick={() => climate.open('escenarios')}
        title="Escenarios climáticos y sandbox"
      >
        <IconDrop className="shrink-0 text-serie-agua" />
        <span className="text-ui-ink-muted">Clima:</span>
        <span className="truncate">{escenario}</span>
      </button>

      <div role="group" aria-label="Capa de color" className="flex items-center gap-1">
        <span className="mr-1 text-2xs text-ui-ink-muted">Capa</span>
        {visibles.map((o) => (
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
