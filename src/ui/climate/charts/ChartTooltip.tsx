/** Tooltip de la gráfica: sigue al mes bajo el cursor. El texto usa tokens de tinta, no el color de la serie. */
export interface FilaTooltip {
  etiqueta: string;
  valor: string;
  color: string;
}

export function ChartTooltip({
  titulo,
  filas,
  xPct,
}: {
  titulo: string;
  filas: FilaTooltip[];
  xPct: number;
}) {
  return (
    <div
      role="status"
      className="panel pointer-events-none absolute top-0 z-hud min-w-32 px-2 py-1.5 text-2xs"
      style={{ left: `${Math.min(Math.max(xPct, 12), 88)}%`, transform: 'translateX(-50%)' }}
    >
      <div className="mb-0.5 font-semibold text-ui-ink">{titulo}</div>
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-center justify-between gap-3 text-ui-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: f.color }} />
            {f.etiqueta}
          </span>
          <span className="value text-ui-ink">{f.valor}</span>
        </div>
      ))}
    </div>
  );
}

export function Leyenda({
  items,
}: {
  items: { etiqueta: string; color: string; tipo: 'barra' | 'linea' | 'fantasma' }[];
}) {
  return (
    <ul className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-ui-ink-muted">
      {items.map((i) => (
        <li key={i.etiqueta} className="flex items-center gap-1.5">
          {i.tipo === 'barra' && (
            <span className="inline-block h-2.5 w-2 rounded-t-sm" style={{ backgroundColor: i.color }} />
          )}
          {i.tipo === 'linea' && (
            <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: i.color }} />
          )}
          {i.tipo === 'fantasma' && (
            <span
              className="inline-block h-2.5 w-2 rounded-t-sm border border-dashed"
              style={{ borderColor: i.color }}
            />
          )}
          {i.etiqueta}
        </li>
      ))}
    </ul>
  );
}
