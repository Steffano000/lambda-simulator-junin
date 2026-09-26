/** Temperatura media y mínima por mes (°C), con la línea de 0 °C marcada como referencia de helada. */
import { useState } from 'react';
import type { ClimaMes } from '@/data/types';
import { MESES } from '@/domain/crops';
import { serie } from '@/theme/tokens';
import { ChartTooltip, Leyenda } from './ChartTooltip';
import { marco, MESES_CORTOS, ticks, xMes, yValor, anchoBanda } from './scale';

const ANCHO = 560;

export function TempChart({ meses, alto = 150 }: { meses: readonly ClimaMes[]; alto?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const m = marco(ANCHO, alto);
  const orden = [...meses].sort((a, b) => a.mes - b.mes);
  const valores = orden.flatMap((x) => [x.tmed, x.tmin]);
  const min = Math.min(0, Math.floor(Math.min(...valores) / 5) * 5);
  const max = Math.max(5, Math.ceil(Math.max(...valores) / 5) * 5);
  const y = (v: number) => yValor(m, v, min, max);
  const w = anchoBanda(m);
  const ruta = (k: 'tmed' | 'tmin') =>
    orden.map((x, i) => `${i ? 'L' : 'M'}${xMes(m, i).toFixed(1)},${y(x[k]).toFixed(1)}`).join(' ');

  return (
    <figure className="relative">
      <Leyenda
        items={[
          { etiqueta: 'T media (°C)', color: serie.demanda, tipo: 'linea' },
          { etiqueta: 'T mínima (°C)', color: serie.agua, tipo: 'linea' },
        ]}
      />
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        className="w-full text-ui-ink-muted"
        role="img"
        aria-label="Temperatura media y mínima mensual (°C)"
        onMouseLeave={() => setHover(null)}
      >
        {ticks(min, max, Math.min(5, (max - min) / 5)).map((t) => (
          <g key={t}>
            <line
              x1={m.izq}
              x2={ANCHO - m.der}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeOpacity={t === 0 ? 0.55 : 0.15}
              strokeDasharray={t === 0 ? '4 3' : undefined}
            />
            <text x={m.izq - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="currentColor">
              {t}
            </text>
          </g>
        ))}

        {(['tmed', 'tmin'] as const).map((k) => (
          <g key={k}>
            <path
              d={ruta(k)}
              fill="none"
              stroke={k === 'tmed' ? serie.demanda : serie.agua}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {orden.map((x, i) => (
              <circle
                key={x.mes}
                cx={xMes(m, i)}
                cy={y(x[k])}
                r={hover === i ? 4.5 : 3}
                fill={k === 'tmed' ? serie.demanda : serie.agua}
                stroke="var(--ui-panel)"
                strokeWidth={1.5}
              />
            ))}
          </g>
        ))}

        {orden.map((x, i) => (
          <text
            key={`l${x.mes}`}
            x={xMes(m, i)}
            y={alto - 4}
            textAnchor="middle"
            fontSize="10"
            fill="currentColor"
          >
            {MESES_CORTOS[x.mes - 1]}
          </text>
        ))}
        {hover !== null && (
          <line
            x1={xMes(m, hover)}
            x2={xMes(m, hover)}
            y1={m.arriba}
            y2={alto - m.abajo}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
        )}
        {orden.map((x, i) => (
          <rect
            key={`h${x.mes}`}
            x={xMes(m, i) - w / 2}
            y={0}
            width={w}
            height={alto}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {hover !== null && (
        <ChartTooltip
          titulo={MESES[orden[hover].mes - 1]}
          xPct={(xMes(m, hover) / ANCHO) * 100}
          filas={[
            { etiqueta: 'T media', valor: `${orden[hover].tmed} °C`, color: serie.demanda },
            { etiqueta: 'T mínima', valor: `${orden[hover].tmin} °C`, color: serie.agua },
          ]}
        />
      )}
      <p className="mt-0.5 text-2xs text-ui-ink-muted">Línea discontinua: 0 °C (referencia de helada).</p>
    </figure>
  );
}
