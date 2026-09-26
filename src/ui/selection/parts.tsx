/** Piezas compartidas de los paneles de selección: marco del panel, filas y barras. */
import type { ReactNode } from 'react';
import { IconClose } from '../components/icons';

export function PanelSeleccion({
  titulo,
  subtitulo,
  icono,
  onCerrar,
  etiqueta,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  icono?: ReactNode;
  onCerrar?: () => void;
  /** Nombre accesible del panel */
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={etiqueta}
      className="panel max-h-[calc(100vh-9rem)] w-64 shrink-0 animate-panel-in overflow-y-auto p-3"
    >
      <header className="mb-2 flex items-start gap-2">
        {icono && <span className="mt-0.5 text-xl">{icono}</span>}
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold">{titulo}</h2>
          {subtitulo && <p className="text-2xs text-ui-ink-muted">{subtitulo}</p>}
        </div>
        {onCerrar && (
          <button className="btn px-1.5" onClick={onCerrar} aria-label="Cerrar selección">
            <IconClose />
          </button>
        )}
      </header>
      {children}
    </aside>
  );
}

export function Fila({ label, value, unit }: { label: ReactNode; value: ReactNode; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ui-border py-1 last:border-0">
      <dt className="text-2xs text-ui-ink-muted">{label}</dt>
      <dd className="value text-right text-ui-ink">
        {value}
        {unit && <span className="ml-1 text-ui-ink-muted">{unit}</span>}
      </dd>
    </div>
  );
}

export function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-2.5 first:mt-0">
      <h3 className="mb-0.5 text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">{titulo}</h3>
      <dl>{children}</dl>
    </section>
  );
}

/** Barra 0–100 con una marca opcional (p. ej. umbral de estrés); el valor va aparte, en texto. */
export function Barra({ valor, color, marca }: { valor: number; color: string; marca?: number }) {
  return (
    <div className="relative my-1 h-1.5 rounded-full bg-ui-panel-2" aria-hidden>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, valor))}%`, backgroundColor: color }}
      />
      {marca !== undefined && (
        <div
          className="absolute inset-y-[-2px] w-0.5 bg-ui-ink"
          style={{ left: `${Math.min(100, marca)}%` }}
        />
      )}
    </div>
  );
}
