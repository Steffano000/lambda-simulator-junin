/**
 * 24 meses de un escenario: lluvia (barras, con intervalo del 80 %), ET0 (línea) y el
 * semáforo P/ET0 debajo. Resalta los meses de la campaña del cultivo elegido.
 */
import type { MesClima } from '@/domain/junin';

const SEMAFORO = { verde: '#2E8B57', ambar: '#E3A72F', rojo: '#C0392B' } as const;
const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function GraficoEscenario({
  meses,
  inf,
  sup,
  campana,
}: {
  meses: MesClima[];
  inf?: (number | undefined)[];
  sup?: (number | undefined)[];
  /** Meses 'YYYY-MM' del ciclo del cultivo */
  campana?: Set<string>;
}) {
  const W = 480;
  const H = 170;
  const izq = 30;
  const abajo = 34;
  const alto = H - abajo - 8;
  const ancho = W - izq - 6;
  const max = Math.max(50, ...meses.map((m) => Math.max(m.lluvia, m.et0)), ...(sup ?? []).map((x) => x ?? 0));
  const y = (v: number) => 8 + alto - (v / max) * alto;
  const bw = ancho / meses.length;
  const marcas = [0, Math.round(max / 2 / 10) * 10, Math.round(max / 10) * 10];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Lluvia, ET0 y semáforo P/ET0 de 24 meses"
    >
      {marcas.map((v) => (
        <g key={v}>
          <line x1={izq} x2={W - 6} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={izq - 4} y={y(v) + 3} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.6}>
            {v}
          </text>
        </g>
      ))}
      {meses.map((m, i) => {
        const x = izq + i * bw;
        const enCampana = campana?.has(m.mes);
        return (
          <g key={m.mes}>
            {enCampana && <rect x={x} y={8} width={bw} height={alto} fill="#3f6b3a" opacity={0.08} />}
            <rect
              x={x + bw * 0.18}
              y={y(m.lluvia)}
              width={bw * 0.64}
              height={Math.max(0, y(0) - y(m.lluvia))}
              fill="#4A90C2"
            >
              <title>
                {m.mes}: lluvia {m.lluvia.toFixed(0)} mm · ET0 {m.et0.toFixed(0)} mm · P/ET0{' '}
                {m.indice.toFixed(2)} ({m.clase})
              </title>
            </rect>
            {inf?.[i] != null && sup?.[i] != null && (
              <line
                x1={x + bw / 2}
                x2={x + bw / 2}
                y1={y(inf[i]!)}
                y2={y(sup[i]!)}
                stroke="#1b3a57"
                strokeWidth={1}
                opacity={0.6}
              />
            )}
            <rect x={x + 1} y={H - abajo + 4} width={bw - 2} height={8} rx={2} fill={SEMAFORO[m.semaforo]}>
              <title>
                {m.mes}: P/ET0 {m.indice.toFixed(2)} · {m.clase}
              </title>
            </rect>
            <text
              x={x + bw / 2}
              y={H - abajo + 24}
              fontSize={8.5}
              textAnchor="middle"
              fill="currentColor"
              opacity={0.7}
            >
              {MESES[Number(m.mes.slice(5, 7)) - 1]}
            </text>
            {m.mes.endsWith('-01') && (
              <text x={x + 1} y={H - 1} fontSize={8.5} fill="currentColor" opacity={0.7}>
                {m.mes.slice(0, 4)}
              </text>
            )}
          </g>
        );
      })}
      <polyline
        fill="none"
        stroke="#E07B39"
        strokeWidth={2}
        points={meses.map((m, i) => `${izq + i * bw + bw / 2},${y(m.et0)}`).join(' ')}
      />
    </svg>
  );
}
