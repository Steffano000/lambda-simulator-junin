/**
 * Grilla de cubos 1 m³ con instancing (design.md §2): el contenedor de los modelos 3D
 * que se apoyan en el terreno.
 *
 * Fase 5 · en la parcela real el terreno puede verse como BLOQUES (una celda = un cubo) o como
 * superficie CONTINUA recortada al polígono, con suavizado y exageración vertical (1-3×).
 * Las capas que se apoyan en el terreno (surcos, plantas, marcas) reciben las celdas ya con la
 * altura de la vista, así quedan sobre la superficie en los dos modos.
 *
 * VISTA: solo lee el store. La selección se delega al controlador (useTilePicking) y el
 * offset de centrado se calcula una vez por cambio de config.
 */
import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useResaltadas } from '@/controllers/hooks';
import { EXAGERACION_RELIEVE } from '@/domain/junin/puente';
import { useJuninStore } from '@/store/juninStore';
import { useSimStore } from '@/store/useSimStore';
import { useVistaStore } from '@/store/vistaStore';
import { PlantsLayer, PreviewPlantsLayer } from '@/scene/crops';
import { FurrowsLayer } from '@/scene/furrows';
import { SelectionLayer } from '@/scene/markers';
import { construirHeightfield, alturaEn, TerrainSurface, type Punto2 } from '@/scene/terrain';
import { gridOffset, tileHeight } from '@/scene/tiles';
import { TileField } from './TileField';
import { useTilePicking } from './useTilePicking';

export function GridRoot() {
  const todas = useSimStore((s) => s.tiles);
  // Las celdas fuera de la parcela real no se dibujan ni se pueden elegir
  const visibles = useMemo(() => todas.filter((t) => !t.oculto), [todas]);
  const config = useSimStore((s) => s.config);
  const overlay = useSimStore((s) => s.overlay);
  const seleccion = useSimStore((s) => s.seleccion);
  const resaltadas = useResaltadas();
  const modo = useVistaStore((s) => s.terreno);
  const suavizado = useVistaStore((s) => s.suavizado);
  const exageracion = useVistaStore((s) => s.exageracion);
  const anillo = useJuninStore((s) => s.anillo);
  const chunks = useJuninStore((s) => s.chunks);

  const parcelaReal = useMemo(() => visibles.some((t) => t.ladoM != null), [visibles]);
  const continuo = parcelaReal && modo === 'continuo';
  // La exageración ×3 viene de puente.ts; la vista la lleva a 1-3×
  const k = parcelaReal ? exageracion / EXAGERACION_RELIEVE : 1;

  // Centro de la grilla en el origen
  const offset = useMemo(() => gridOffset(config), [config]);

  const hf = useMemo(() => {
    if (!continuo) return null;
    const alturas: (number | null)[] = new Array(config.rows * config.cols).fill(null);
    for (const t of visibles)
      if (!t.sinAltura) alturas[t.coords.z * config.cols + t.coords.x] = t.elevacion * k;
    return construirHeightfield(config.rows, config.cols, alturas, suavizado);
  }, [continuo, visibles, config, k, suavizado]);

  // Polígono de la parcela en coordenadas de grilla (solo si la grilla del 3D es la de los chunks)
  const poligono = useMemo<Punto2[] | null>(() => {
    if (!continuo || !anillo || !chunks) return null;
    if (chunks.filas !== config.rows || chunks.columnas !== config.cols) return null;
    const [oeste, , , norte] = chunks.bbox;
    return anillo.map(([lon, lat]) => [(lon - oeste) / chunks.dlon, (norte - lat) / chunks.dlat]);
  }, [continuo, anillo, chunks, config]);

  // Celdas con la altura de la vista: lo que se apoya en el terreno queda sobre la superficie
  const tiles = useMemo(() => {
    if (hf)
      return visibles.map((t) => ({
        ...t,
        elevacion: alturaEn(hf, t.coords.x + 0.5, t.coords.z + 0.5) - tileHeight(t),
      }));
    return k === 1 ? visibles : visibles.map((t) => ({ ...t, elevacion: t.elevacion * k }));
  }, [visibles, hf, k]);

  const seleccionSet = useMemo(() => new Set(seleccion), [seleccion]);
  const porCelda = useMemo(() => new Map(tiles.map((t) => [`${t.coords.x}:${t.coords.z}`, t.id])), [tiles]);
  const idDeSuperficie = useMemo(
    () =>
      continuo
        ? (e: ThreeEvent<PointerEvent>) =>
            porCelda.get(
              `${Math.floor(e.point.x + offset.x + 0.5)}:${Math.floor(e.point.z + offset.z + 0.5)}`,
            )
        : undefined,
    [continuo, porCelda, offset],
  );
  const picking = useTilePicking(tiles, idDeSuperficie);

  return (
    <group>
      {hf ? (
        <TerrainSurface
          tiles={tiles}
          hf={hf}
          offset={offset}
          overlay={overlay}
          poligono={poligono}
          {...picking}
        />
      ) : (
        <TileField tiles={tiles} offset={offset} overlay={overlay} {...picking} />
      )}
      <FurrowsLayer tiles={tiles} offset={offset} overlay={overlay} />
      <PlantsLayer tiles={tiles} offset={offset} />
      <PreviewPlantsLayer tiles={tiles} offset={offset} />
      <SelectionLayer tiles={tiles} offset={offset} ids={resaltadas} tipo="resaltada" />
      <SelectionLayer tiles={tiles} offset={offset} ids={seleccionSet} tipo="seleccion" />
    </group>
  );
}
