/**
 * Inspección de la selección sobre la escena:
 *  - Una celda: panel de la CELDA y, si tiene cultivo, panel del CULTIVO al lado.
 *  - Varias celdas: resumen del área.
 */
import { useControllers } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { AreaSummary } from './AreaSummary';
import { CellPanel } from './CellPanel';
import { CropPanel } from './CropPanel';

export function SelectionPanels() {
  const { selection } = useControllers();
  const seleccion = useSimStore((s) => s.seleccion);
  const tiles = useSimStore((s) => s.tiles);
  if (seleccion.length === 0) return null;

  const ids = new Set(seleccion);
  const elegidas = tiles.filter((t) => ids.has(t.id));
  if (elegidas.length === 0) return null;

  const cerrar = () => selection.clear();
  const [unica] = elegidas;

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-inspector flex items-start gap-2 [&>*]:pointer-events-auto">
      {elegidas.length === 1 ? (
        <>
          <CellPanel tile={unica} onCerrar={cerrar} />
          {unica.vegetacionId && <CropPanel tile={unica} />}
        </>
      ) : (
        <AreaSummary tiles={elegidas} onCerrar={cerrar} />
      )}
    </div>
  );
}
