/**
 * Tarjeta de acción con ficha emergente (hover o foco): efectos, cultivos a los que sirve,
 * prerrequisitos, condiciones del terreno y si es necesaria antes de plantar.
 * La ficha se dibuja en un portal con posición fija para no quedar recortada por el panel.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { TileCommand } from '@/domain/actions';
import type { Crop } from '@/domain/crops';

interface Props {
  command: TileCommand;
  activa: boolean;
  /** Celdas del terreno donde se puede aplicar */
  aplicables: number;
  /** Cultivos aptos del terreno a los que ayuda */
  sirvePara: Crop[];
  /** Cultivos cuyo requisito pendiente resuelve (antes de plantar) */
  necesariaPara: string[];
  onSelect: () => void;
}

export function ActionCard({ command, activa, aplicables, sirvePara, necesariaPara, onSelect }: Props) {
  const [ancla, setAncla] = useState<DOMRect | null>(null);
  const mostrar = (el: HTMLElement) => setAncla(el.getBoundingClientRect());
  const ocultar = () => setAncla(null);
  const fichaId = `ficha-${command.id}`;

  return (
    <>
      <button
        className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
          activa ? 'border-ui-accent bg-ui-panel-2' : 'border-ui-border hover:bg-ui-panel-2'
        }`}
        aria-pressed={activa}
        aria-describedby={ancla ? fichaId : undefined}
        onClick={onSelect}
        onMouseEnter={(e) => mostrar(e.currentTarget)}
        onMouseLeave={ocultar}
        onFocus={(e) => mostrar(e.currentTarget)}
        onBlur={ocultar}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">{command.etiqueta}</span>
          <span className="value text-2xs text-ui-ink-muted">{aplicables} celdas</span>
        </div>
        <div className="mt-0.5 text-2xs text-ui-ink-muted">{command.efectos[0]}</div>
        {necesariaPara.length > 0 && (
          <div className="mt-1 text-2xs font-medium text-etapa-final">
            Necesaria para {necesariaPara.join(', ')}
          </div>
        )}
      </button>

      {ancla &&
        createPortal(
          <div
            id={fichaId}
            role="tooltip"
            className="panel fixed z-modal w-72 animate-panel-in p-3 text-2xs"
            style={{ left: ancla.right + 8, top: Math.min(ancla.top, window.innerHeight - 320) }}
          >
            <h3 className="mb-1 text-xs font-semibold text-ui-ink">{command.etiqueta}</h3>
            <p className="mb-2 text-ui-ink-muted">{command.descripcion}</p>
            <Lista titulo="Efectos" items={command.efectos} />
            <Lista titulo="Prerrequisitos de la celda" items={command.prerrequisitos} />
            {command.condicionTerreno && (
              <Lista titulo="Condición del terreno" items={[command.condicionTerreno]} />
            )}
            <Lista
              titulo="Sirve para"
              items={
                sirvePara.length
                  ? sirvePara.map((c) => `${c.nombre}: ${requisitosResueltos(command, c)}`)
                  : ['Manejo general del terreno (no es requisito de siembra)']
              }
            />
            {necesariaPara.length > 0 && (
              <Lista
                titulo="Antes de plantar"
                items={[`Hay celdas que la necesitan para ${necesariaPara.join(', ')}.`]}
                destacado
              />
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function requisitosResueltos(command: TileCommand, crop: Crop): string {
  return crop.requisitos
    .filter((r) => command.resuelve.includes(r.id))
    .map((r) => r.condicion)
    .join(' · ');
}

function Lista({
  titulo,
  items,
  destacado,
}: {
  titulo: string;
  items: readonly string[];
  destacado?: boolean;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className={`font-semibold ${destacado ? 'text-etapa-final' : 'text-ui-ink'}`}>{titulo}</div>
      <ul className="list-disc pl-4 text-ui-ink-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
