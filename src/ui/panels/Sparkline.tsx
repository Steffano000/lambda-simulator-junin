/** Mini gráfica de evolución (salud y humedad 0–100) de una plantación. */
import type { PuntoHistorial } from '@/domain/plantation';
import { chi, humedad } from '@/theme/tokens';

const W = 240;
const H = 48;

function path(puntos: PuntoHistorial[], key: 'salud' | 'humedad', d0: number, d1: number): string {
  const span = Math.max(1, d1 - d0);
  return puntos
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${(((p.dia - d0) / span) * W).toFixed(1)},${(H - (p[key] / 100) * H).toFixed(1)}`,
    )
    .join(' ');
}

export function Sparkline({ historial }: { historial: PuntoHistorial[] }) {
  if (historial.length < 2) {
    return <p className="text-2xs text-ui-ink-muted">Avanza el tiempo para ver la evolución.</p>;
  }
  const d0 = historial[0].dia;
  const d1 = historial.at(-1)!.dia;
  const ultimo = historial.at(-1)!;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-12 w-full overflow-visible"
        role="img"
        aria-label={`Evolución: salud ${ultimo.salud}, humedad ${ultimo.humedad} % al día ${d1}`}
      >
        <line
          x1="0"
          x2={W}
          y1={H * 0.3}
          y2={H * 0.3}
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeDasharray="2 3"
        />
        <path d={path(historial, 'humedad', d0, d1)} fill="none" stroke={humedad[60]} strokeWidth="1.5" />
        <path d={path(historial, 'salud', d0, d1)} fill="none" stroke={chi[100]} strokeWidth="2" />
      </svg>
      <figcaption className="mt-0.5 flex justify-between text-2xs text-ui-ink-muted">
        <span>día {d0}</span>
        <span className="flex gap-2">
          <span style={{ color: chi[100] }}>— salud {ultimo.salud}</span>
          <span style={{ color: humedad[60] }}>— humedad {ultimo.humedad} %</span>
        </span>
        <span>día {d1}</span>
      </figcaption>
    </figure>
  );
}
