/**
 * Puntero → selección de celdas. La escena no decide nada: traduce el evento de Three.js
 * a intenciones del SelectionController (inicio, extensión, limpiar).
 *
 * Reglas: solo botón izquierdo (el derecho gira la cámara), el arrastre puede terminar
 * fuera del canvas y un clic en el vacío limpia la selección.
 */
import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useControllers } from '@/controllers/hooks';
import type { TileNode } from '@/domain/grid';

export interface TilePicking {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMissed: (e: MouseEvent) => void;
}

/**
 * @param idDeEvento cómo saber qué celda tocó el puntero; por defecto, la instancia del bloque.
 *   La superficie continua (Fase 5) lo calcula con el punto de impacto.
 */
export function useTilePicking(
  tiles: readonly TileNode[],
  idDeEvento?: (e: ThreeEvent<PointerEvent>) => string | undefined,
): TilePicking {
  const { selection } = useControllers();

  // El arrastre puede terminar fuera del canvas
  useEffect(() => {
    const end = () => selection.end();
    window.addEventListener('pointerup', end);
    return () => window.removeEventListener('pointerup', end);
  }, [selection]);

  return useMemo(() => {
    const idDe =
      idDeEvento ??
      ((e: ThreeEvent<PointerEvent>) => (e.instanceId !== undefined ? tiles[e.instanceId]?.id : undefined));

    return {
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return; // derecho/central: cámara
        e.stopPropagation();
        const id = idDe(e);
        if (id) selection.begin(id);
      },
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        if (!selection.arrastrando) return;
        const id = idDe(e);
        if (id) selection.extend(id);
      },
      onPointerMissed: (e: MouseEvent) => {
        if (e.button === 0) selection.clear();
      },
    };
  }, [selection, tiles, idDeEvento]);
}
