/** Panel climático (modal): pestañas "Escenarios" (selección y comparativa) y "Sandbox climático". */
import { useEffect } from 'react';
import { useControllers } from '@/controllers/hooks';
import { useSimStore, type VistaClima } from '@/store/useSimStore';
import { IconClose } from '../components/icons';
import { ClimateSandbox } from './ClimateSandbox';
import { ScenarioComparison } from './ScenarioComparison';
import { ScenarioGallery } from './ScenarioGallery';

const PESTANAS: { id: VistaClima; label: string }[] = [
  { id: 'escenarios', label: 'Escenarios' },
  { id: 'sandbox', label: 'Sandbox climático' },
];

export function ClimateModal() {
  const { climate } = useControllers();
  const vista = useSimStore((s) => s.vistaClima);
  const activo = useSimStore((s) => s.escenario);

  useEffect(() => {
    if (!vista) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && climate.close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vista, climate]);

  if (!vista) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      onClick={() => climate.close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clima-titulo"
        className="panel flex h-[88vh] w-full max-w-6xl animate-panel-in flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-4 border-b border-ui-border px-4 py-3">
          <div>
            <h2 id="clima-titulo" className="text-sm font-semibold">
              Clima
            </h2>
            <p className="text-2xs text-ui-ink-muted">
              Activo: <span className="font-medium text-ui-ink">{activo}</span>
            </p>
          </div>
          <nav role="tablist" className="flex gap-1">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={vista === p.id}
                className={`btn ${vista === p.id ? 'btn-active' : ''}`}
                onClick={() => climate.open(p.id)}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <button
            className="btn ml-auto px-1.5"
            onClick={() => climate.close()}
            aria-label="Cerrar panel climático"
          >
            <IconClose />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {vista === 'escenarios' ? (
            <div className="space-y-6">
              <ScenarioGallery />
              <ScenarioComparison />
            </div>
          ) : (
            <ClimateSandbox />
          )}
        </div>
      </div>
    </div>
  );
}
