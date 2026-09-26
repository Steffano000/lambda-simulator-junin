/**
 * Estado hídrico del terreno (reparto por estado de hidratación) y su efecto en las plantas.
 * Barra apilada con separación entre segmentos; el conteo siempre acompaña al color.
 */
import { useResumenHidrico } from '@/controllers/hooks';
import { ESTADOS_HIDRICOS, ETIQUETA_HIDRICA, type EfectoHidrico } from '@/domain/hydrology';
import { hidratacion } from '@/theme/tokens';
import { VARIABLE_CLIMA } from '../../icons';

const EFECTO: Record<EfectoHidrico, { etiqueta: string; tono: string }> = {
  deficit: { etiqueta: 'con déficit (estrés, crecen más lento)', tono: 'text-chi-estresado' },
  adecuado: { etiqueta: 'con hidratación adecuada', tono: 'text-chi-saludable' },
  exceso: { etiqueta: 'con exceso (menos oxígeno y nutrientes)', tono: 'text-chi-estresado' },
  encharcado: { etiqueta: 'encharcadas (asfixia de raíces)', tono: 'text-chi-critico' },
};

export function HydrationSummary() {
  const r = useResumenHidrico();
  if (r.total === 0) return null;
  const vivas = Object.values(r.plantas).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-1.5 flex h-3 gap-0.5 overflow-hidden rounded-sm" aria-hidden>
        {ESTADOS_HIDRICOS.filter((e) => r.estados[e] > 0).map((e) => (
          <div
            key={e}
            className="first:rounded-l-sm last:rounded-r-sm"
            style={{ flexGrow: r.estados[e], backgroundColor: hidratacion[e] }}
          />
        ))}
      </div>
      <ul className="mb-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-2xs">
        {ESTADOS_HIDRICOS.map((e) => (
          <li key={e} className={`flex items-center gap-1.5 ${r.estados[e] ? '' : 'opacity-50'}`}>
            <span className="swatch" style={{ backgroundColor: hidratacion[e] }} />
            <span className="flex-1 text-ui-ink-muted">{ETIQUETA_HIDRICA[e]}</span>
            <span className="value text-ui-ink">{r.estados[e]}</span>
          </li>
        ))}
      </ul>

      <p className="mb-2 text-2xs text-ui-ink-muted">
        Agua libre en surcos y charcos:{' '}
        <span className="value text-ui-ink">{Math.round(r.aguaSuperficieL)} L</span> · celdas con surcos:{' '}
        <span className="value text-ui-ink">{r.celdasConSurcos}</span>
      </p>

      {vivas > 0 && (
        <>
          <h4 className="mb-0.5 text-2xs font-semibold text-ui-ink">Efecto en las plantas</h4>
          <ul className="space-y-0.5 text-2xs">
            {(Object.keys(EFECTO) as EfectoHidrico[])
              .filter((k) => r.plantas[k] > 0)
              .map((k) => (
                <li key={k} className={`flex items-center gap-1.5 ${EFECTO[k].tono}`}>
                  {k === 'deficit' && <VARIABLE_CLIMA.deficit className="shrink-0 text-xs" />}
                  <span>
                    <span className="value">{r.plantas[k]}</span> {EFECTO[k].etiqueta}
                  </span>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
