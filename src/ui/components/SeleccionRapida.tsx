/**
 * Selección rápida sobre la escena 3D:
 * - botón «Seleccionar toda la parcela» arriba a la derecha,
 * - atajos Ctrl/⌘ + A (todo) y Esc (limpiar),
 * - clic derecho SIN arrastrar sobre el terreno: menú con las mismas opciones
 *   (arrastrar con el botón derecho sigue girando la cámara).
 */
import { useEffect, useRef, useState } from 'react';
import { useControllers } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';

const TOLERANCIA_PX = 5;

export function SeleccionRapida() {
  const { selection } = useControllers();
  const terreno = useSimStore((s) => s.terreno);
  const trabajables = useSimStore((s) => s.tiles.filter((t) => !t.bloqueado).length);
  const seleccion = useSimStore((s) => s.seleccion.length);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const enCanvas = (e: Event) => e.target instanceof HTMLCanvasElement;
    const down = (e: PointerEvent) => {
      if (e.button === 2 && enCanvas(e)) inicio.current = { x: e.clientX, y: e.clientY };
    };
    const ctx = (e: MouseEvent) => {
      if (!enCanvas(e) || !inicio.current) return;
      const movio = Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > TOLERANCIA_PX;
      inicio.current = null;
      e.preventDefault();
      if (movio) return;
      const r = caja.current?.parentElement?.getBoundingClientRect();
      setMenu({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
    };
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (escribiendo) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selection.selectAll();
      }
      if (e.key === 'Escape') {
        setMenu(null);
        selection.clear();
      }
    };
    const cerrar = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('contextmenu', ctx);
    window.addEventListener('keydown', tecla);
    window.addEventListener('pointerdown', cerrar);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('contextmenu', ctx);
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('pointerdown', cerrar);
    };
  }, [selection]);

  if (!terreno) return null;
  return (
    <div ref={caja}>
      <div className="absolute top-4 right-4 z-hud flex flex-col items-end gap-1">
        <button
          className="btn shadow-panel"
          disabled={seleccion === trabajables}
          onClick={() => selection.selectAll()}
          title="Selecciona toda la parcela trabajable · Ctrl + A · o clic derecho sobre el terreno"
        >
          Seleccionar todo ({trabajables})
        </button>
        {seleccion > 0 && (
          <button className="btn shadow-panel" onClick={() => selection.clear()} title="Esc">
            Limpiar
          </button>
        )}
      </div>
      {menu && (
        <div
          className="panel absolute z-hud flex min-w-52 flex-col py-1 text-xs"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            role="menuitem"
            className="px-3 py-1.5 text-left hover:bg-ui-panel-2"
            onClick={() => {
              selection.selectAll();
              setMenu(null);
            }}
          >
            Seleccionar toda la parcela <span className="text-ui-ink-muted">Ctrl+A</span>
          </button>
          <button
            role="menuitem"
            className="px-3 py-1.5 text-left hover:bg-ui-panel-2"
            onClick={() => {
              selection.clear();
              setMenu(null);
            }}
          >
            Limpiar selección <span className="text-ui-ink-muted">Esc</span>
          </button>
        </div>
      )}
    </div>
  );
}
