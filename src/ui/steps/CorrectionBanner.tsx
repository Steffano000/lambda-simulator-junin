/**
 * Flujo alternativo: corrección de celdas que no cumplen los requisitos del cultivo.
 * Lista lo que falta, sugiere el tratamiento y permite volver a cultivos sin reiniciar.
 */
import { useControllers } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { IconBack, IconCheck } from '../components/icons';
import { CropIcon } from '../icons/CropIcon';
import { ToolChips } from '../icons/ToolChip';
import { Section } from '../panels/Section';

export function CorrectionBanner() {
  const { planting } = useControllers();
  const correccion = useSimStore((s) => s.correccion);
  const tiles = useSimStore((s) => s.tiles);
  const herramienta = useSimStore((s) => s.herramienta);
  if (!correccion) return null;

  const ids = new Set(correccion.tileIds);
  const v = planting.validar(
    correccion.cultivo,
    tiles.filter((t) => ids.has(t.id)),
  );
  const completo = v.aCorregir.length === 0;

  return (
    <Section titulo={`Corrigiendo para ${correccion.cultivo}`}>
      <CropIcon nombre={correccion.cultivo} className="float-right -mt-6 text-2xl" />
      {completo ? (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-chi-saludable">
          <IconCheck /> Todas las celdas cumplen ya los requisitos.
        </p>
      ) : (
        <>
          <p className="mb-2 text-2xs text-ui-ink-muted">
            {v.aCorregir.length} de {correccion.tileIds.length} celdas aún no cumplen. Pulsa un pendiente para
            seleccionar sus celdas y su tratamiento.
          </p>
          <ul className="mb-2 space-y-1">
            {v.pendientes.map((p) => {
              const tool = p.herramientas[0] ?? null;
              return (
                <li key={p.requisito.id}>
                  <button
                    className={`w-full rounded-md border px-2 py-1.5 text-left text-2xs ${
                      tool && herramienta === tool ? 'border-ui-accent bg-ui-panel-2' : 'border-ui-border'
                    }`}
                    onClick={() => planting.focusPendiente(p.tileIds, tool)}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-ui-ink">{p.requisito.condicion}</span>
                      <span className="value">{p.tileIds.length} celdas</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-ui-ink-muted">
                      Tratamiento: <ToolChips tools={p.herramientas} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="flex gap-1">
        <button
          className={`btn flex-1 justify-center ${completo ? 'btn-active' : ''}`}
          onClick={() => planting.backToCrops()}
        >
          <IconBack /> Volver a cultivos
        </button>
        <button className="btn" onClick={() => planting.cancelCorrection()}>
          Salir
        </button>
      </div>
    </Section>
  );
}
