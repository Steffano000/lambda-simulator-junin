/** Indicador del flujo: Terreno → Tratamiento → Cultivos → Cosecha (navegable según el estado). */
import { useControllers } from '@/controllers/hooks';
import { useSimStore, type Fase } from '@/store/useSimStore';

const PASOS: { id: Fase; label: string }[] = [
  { id: 'terreno', label: 'Terreno' },
  { id: 'tratamiento', label: 'Tratamiento' },
  { id: 'cultivos', label: 'Cultivos' },
  { id: 'cosecha', label: 'Cosecha' },
];

export function FlowStepper() {
  const { treatment, harvest } = useControllers();
  const fase = useSimStore((s) => s.fase);
  const terreno = useSimStore((s) => s.terreno);
  const hayTratadas = useSimStore((s) => s.tiles.some((t) => t.estado === 'arado'));
  const hayPlantaciones = useSimStore((s) => s.plantaciones.length > 0);
  const actual = PASOS.findIndex((p) => p.id === fase);

  const habilitado = (id: Fase) => {
    if (id === 'terreno') return fase === 'terreno';
    if (id === 'tratamiento') return !!terreno;
    if (id === 'cosecha') return !!terreno && hayPlantaciones;
    return !!terreno && hayTratadas;
  };

  const ir = (id: Fase) => {
    if (id === 'tratamiento') treatment.goToTreatments();
    if (id === 'cultivos') treatment.goToCrops();
    if (id === 'cosecha') harvest.goToHarvest();
  };

  return (
    <nav aria-label="Flujo" className="flex items-center gap-1">
      {PASOS.map((p, i) => {
        const actualPaso = p.id === fase;
        // El terreno confirmado solo se cambia con "Cambiar terreno" (descarta el avance)
        const bloqueado = !actualPaso && !habilitado(p.id);
        return (
          <div key={p.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-ui-ink-muted">›</span>}
            <button
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                actualPaso
                  ? 'cursor-default bg-ui-accent font-semibold text-ui-accent-ink'
                  : i < actual
                    ? 'text-ui-ink enabled:hover:bg-ui-panel-2 disabled:cursor-default'
                    : 'text-ui-ink-muted hover:bg-ui-panel-2 disabled:cursor-not-allowed disabled:opacity-40'
              }`}
              aria-current={actualPaso ? 'step' : undefined}
              disabled={bloqueado}
              onClick={() => !actualPaso && ir(p.id)}
            >
              <span className="value mr-1 opacity-70">{i < actual ? '✓' : i + 1}</span>
              {p.label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
