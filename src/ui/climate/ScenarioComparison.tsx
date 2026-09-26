/**
 * Comparativa cultivo × escenario (docs/05 · func. 6): ETc, lluvia y balance hídrico del
 * ciclo completo, sembrando en el mes de siembra del cultivo. Barra divergente del balance
 * (déficit ← 0 → excedente); el valor numérico siempre acompaña al color.
 */
import { useMemo } from 'react';
import { container } from '@/app/container';
import { useControllers, useEscenarios } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import { useSimStore } from '@/store/useSimStore';
import { serie } from '@/theme/tokens';

export function ScenarioComparison() {
  const { climate } = useControllers();
  const cultivo = useSimStore((s) => s.cultivoComparacion);
  const activo = useSimStore((s) => s.escenario);
  const escenarios = useEscenarios();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filas = useMemo(() => climate.comparar(cultivo), [cultivo, escenarios]);
  const crop = container.crops.find(cultivo);
  const maxAbs = Math.max(1, ...filas.map((f) => Math.abs(f.balance)));

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">
          Balance hídrico del ciclo por escenario
        </h3>
        <label className="flex items-center gap-2 text-2xs text-ui-ink-muted">
          Cultivo
          <select
            className="field w-44"
            value={cultivo}
            onChange={(e) => climate.setCultivoComparacion(e.target.value)}
          >
            {container.crops.all().map((c) => (
              <option key={c.nombre} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      {crop && (
        <p className="mb-2 text-2xs text-ui-ink-muted">
          Siembra en {MESES[crop.datos.mes_siembra - 1]}, {crop.cicloDias} días. ETc = Kc diario (FAO-56) ×
          ET0. Balance = lluvia − ETc: lo negativo debe cubrirse con riego.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead className="text-left text-ui-ink-muted">
            <tr className="border-b border-ui-border">
              <th className="py-1 pr-2 font-medium">Escenario</th>
              <th className="px-2 text-right font-medium">Lluvia</th>
              <th className="px-2 text-right font-medium">ETc</th>
              <th className="px-2 text-right font-medium">Balance</th>
              <th className="w-40 px-2 font-medium">
                <span className="sr-only">Gráfica del balance</span>
              </th>
              <th className="pl-2 text-right font-medium">Días helada</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const ancho = (Math.abs(f.balance) / maxAbs) * 50;
              const esActivo = f.escenario === activo;
              return (
                <tr
                  key={f.escenario}
                  className={`cursor-pointer border-b border-ui-border/60 hover:bg-ui-panel-2 ${
                    esActivo ? 'bg-ui-panel-2 font-semibold' : ''
                  }`}
                  onClick={() => climate.select(f.escenario)}
                  title="Usar este escenario"
                >
                  <td className="py-1.5 pr-2 text-ui-ink">
                    {esActivo && '● '}
                    {f.escenario}
                  </td>
                  <td className="value px-2 text-right">{f.lluvia.toFixed(0)} mm</td>
                  <td className="value px-2 text-right">{f.etc.toFixed(0)} mm</td>
                  <td className="value px-2 text-right text-ui-ink">
                    {f.balance > 0 ? '+' : ''}
                    {f.balance.toFixed(0)} mm
                  </td>
                  <td className="px-2">
                    <div className="relative h-2.5">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-ui-ink-muted/50" />
                      <div
                        className="absolute inset-y-0 rounded-sm"
                        style={{
                          left: f.balance < 0 ? `${50 - ancho}%` : '50%',
                          width: `${ancho}%`,
                          backgroundColor: f.balance < 0 ? serie.demanda : serie.agua,
                        }}
                      />
                    </div>
                  </td>
                  <td className="value pl-2 text-right">
                    {crop?.datos.helada_letal === null ? '—' : f.diasHelada}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-2xs text-ui-ink-muted">
        <span style={{ color: serie.demanda }}>■</span> déficit · <span style={{ color: serie.agua }}>■</span>{' '}
        excedente · "—" = el cultivo no tiene dato de helada letal. Clic en una fila para usar ese escenario.
      </p>
    </section>
  );
}
