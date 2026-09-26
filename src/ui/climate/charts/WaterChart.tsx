/**
 * Lluvia (barras) y ET0 (línea) por mes, en un único eje de milímetros.
 * Opcional: la lluvia del escenario base como barra fantasma (comparación en el sandbox).
 */
import { useState } from 'react';
import type { ClimaMes } from '@/data/types';
import { MESES } from '@/domain/crops';
import { serie } from '@/theme/tokens';
import { ChartTooltip, Leyenda } from './ChartTooltip';
import { anchoBanda, barra, marco, MESES_CORTOS, techo, ticks, xMes, yValor } from './scale';

interface Props {
  meses: readonly ClimaMes[];
  base?: readonly ClimaMes[];
  alto?: number;
  compacto?: boolean;
  titulo?: string;
}

const ANCHO = 560;

export function WaterChart({ meses, base, alto = 180, compacto = false, titulo }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const m = marco(ANCHO, alto, compacto);
  const orden = [...meses].sort((a, b) => a.mes - b.mes);
  const ordenBase = base ? [...base].sort((a, b) => a.mes - b.mes) : null;
  const max = techo(
    Math.max(...orden.flatMap((x) => [x.lluvia, x.et0]), ...(ordenBase?.map((x) => x.lluvia) ?? [])),
    50,
  );
  const y = (v: number) => yValor(m, v, 0, max);
  const w = anchoBanda(m);
  const cero = y(0);
  const linea = orden
    .map((x, i) => `${i ? 'L' : 'M'}${xMes(m, i).toFixed(1)},${y(x.et0).toFixed(1)}`)
    .join(' ');

  return (
    <figure className="relative">
      {!compacto && (
        <Leyenda
          items={[
            { etiqueta: 'Lluvia (mm)', color: serie.agua, tipo: 'barra' },
            { etiqueta: 'ET0 (mm)', color: serie.demanda, tipo: 'linea' },
            ...(ordenBase
              ? [{ etiqueta: 'Lluvia del escenario base', color: serie.agua, tipo: 'fantasma' as const }]
              : []),
          ]}
        />
      )}
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        className="w-full text-ui-ink-muted"
        role="img"
        aria-label={titulo ?? 'Lluvia y ET0 mensuales (mm)'}
        onMouseLeave={() => setHover(null)}
      >
        {!compacto &&
          // Marcas redondas: cada 50 mm (cada 100 mm si el máximo supera 300)
          ticks(0, max, max / (max > 300 ? 100 : 50)).map((t) => (
            <g key={t}>
              <line
                x1={m.izq}
                x2={ANCHO - m.der}
                y1={y(t)}
                y2={y(t)}
                stroke="currentColor"
                strokeOpacity={0.15}
              />
              <text x={m.izq - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="currentColor">
                {t}
              </text>
            </g>
          ))}

        {ordenBase?.map((x, i) => (
          <path
            key={`b${x.mes}`}
            d={barra(xMes(m, i) - w * 0.3, y(x.lluvia), w * 0.6, cero)}
            fill="none"
            stroke={serie.agua}
            strokeOpacity={0.6}
            strokeDasharray="3 2"
          />
        ))}
        {orden.map((x, i) => (
          <path
            key={x.mes}
            d={barra(xMes(m, i) - w * 0.25, y(x.lluvia), w * 0.5, cero)}
            fill={serie.agua}
            opacity={hover === null || hover === i ? 1 : 0.45}
          />
        ))}
        <path d={linea} fill="none" stroke={serie.demanda} strokeWidth={2} strokeLinejoin="round" />
        {orden.map((x, i) => (
          <circle
            key={`p${x.mes}`}
            cx={xMes(m, i)}
            cy={y(x.et0)}
            r={hover === i ? 4.5 : 3}
            fill={serie.demanda}
            stroke="var(--ui-panel)"
            strokeWidth={1.5}
          />
        ))}
        <line x1={m.izq} x2={ANCHO - m.der} y1={cero} y2={cero} stroke="currentColor" strokeOpacity={0.4} />

        {!compacto &&
          orden.map((x, i) => (
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

        {/* Zonas de hover más grandes que la marca */}
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
            { etiqueta: 'Lluvia', valor: `${orden[hover].lluvia} mm`, color: serie.agua },
            { etiqueta: 'ET0', valor: `${orden[hover].et0} mm`, color: serie.demanda },
            {
              etiqueta: 'Balance',
              valor: `${(orden[hover].lluvia - orden[hover].et0).toFixed(1)} mm`,
              color: 'transparent',
            },
            ...(ordenBase
              ? [{ etiqueta: 'Lluvia base', valor: `${ordenBase[hover].lluvia} mm`, color: 'transparent' }]
              : []),
          ]}
        />
      )}
    </figure>
  );
}
