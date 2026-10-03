/**
 * Grilla de cubos 1 m³ con instancing (design.md §2): el contenedor de los modelos 3D
 * que se apoyan en el terreno.
 *
 * VISTA: solo lee el store. La selección se delega al controlador (useTilePicking) y el
 * offset de centrado se calcula una vez por cambio de config.
 */
import { useMemo } from 'react';
import { useResaltadas } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { PlantsLayer, PreviewPlantsLayer } from '@/scene/crops';
import { FurrowsLayer } from '@/scene/furrows';
import { SelectionLayer } from '@/scene/markers';
import { gridOffset } from '@/scene/tiles';
import { TileField } from './TileField';
import { useTilePicking } from './useTilePicking';

export function GridRoot() {
  const todas = useSimStore((s) => s.tiles);
  // Las celdas fuera de la parcela real no se dibujan ni se pueden elegir
  const tiles = useMemo(() => todas.filter((t) => !t.oculto), [todas]);
  const config = useSimStore((s) => s.config);
  const overlay = useSimStore((s) => s.overlay);
  const seleccion = useSimStore((s) => s.seleccion);
  const resaltadas = useResaltadas();

  // Centro de la grilla en el origen
  const offset = useMemo(() => gridOffset(config), [config]);
  const seleccionSet = useMemo(() => new Set(seleccion), [seleccion]);
  const picking = useTilePicking(tiles);

  return (
    <group>
      <TileField tiles={tiles} offset={offset} overlay={overlay} {...picking} />
      <FurrowsLayer tiles={tiles} offset={offset} overlay={overlay} />
      <PlantsLayer tiles={tiles} offset={offset} />
      <PreviewPlantsLayer tiles={tiles} offset={offset} />
      <SelectionLayer tiles={tiles} offset={offset} ids={resaltadas} tipo="resaltada" />
      <SelectionLayer tiles={tiles} offset={offset} ids={seleccionSet} tipo="seleccion" />
    </group>
  );
}
