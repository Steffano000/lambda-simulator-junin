/**
 * Tabla editable de los 12 meses del borrador. Los valores calculados por los modificadores
 * se pueden sobrescribir a mano; las celdas editadas se marcan y se pueden restablecer.
 * Es también la "vista de tabla" accesible de las gráficas.
 */
import { useControllers } from '@/controllers/hooks';
import type { ClimaMes } from '@/data/types';
import { LIMITES_CLIMA, type CampoClima, type Ediciones } from '@/domain/climate';

const COLUMNAS: { campo: CampoClima; etiqueta: string; unidad: string; paso: number }[] = [
  { campo: 'lluvia', etiqueta: 'Lluvia', unidad: 'mm', paso: 1 },
  { campo: 'et0', etiqueta: 'ET0', unidad: 'mm', paso: 1 },
  { campo: 'tmed', etiqueta: 'T media', unidad: '°C', paso: 0.1 },
  { campo: 'tmin', etiqueta: 'T mínima', unidad: '°C', paso: 0.1 },
];

interface Props {
  meses: ClimaMes[];
  ediciones: Ediciones;
}

export function MonthTable({ meses, ediciones }: Props) {
  const { climate } = useControllers();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-2xs">
        <caption className="sr-only">Valores mensuales del escenario en edición</caption>
        <thead className="text-ui-ink-muted">
          <tr className="border-b border-ui-border">
            <th className="py-1 pr-2 text-left font-medium">Mes</th>
            {COLUMNAS.map((c) => (
              <th key={c.campo} className="px-1 text-right font-medium">
                {c.etiqueta} <span className="font-normal">({c.unidad})</span>
              </th>
            ))}
            <th className="pl-1 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => {
            const balance = m.lluvia - m.et0;
            return (
              <tr key={m.mes} className="border-b border-ui-border/50">
                <th scope="row" className="py-0.5 pr-2 text-left font-medium text-ui-ink">
                  {m.nombre}
                </th>
                {COLUMNAS.map((c) => {
                  const editado = ediciones[m.mes]?.[c.campo] !== undefined;
                  const { min, max } = LIMITES_CLIMA[c.campo];
                  return (
                    <td key={c.campo} className="px-1 py-0.5 text-right">
                      <span className="inline-flex items-center gap-0.5">
                        <input
                          type="number"
                          step={c.paso}
                          min={min}
                          max={max}
                          value={m[c.campo]}
                          onChange={(e) =>
                            climate.setValor(
                              m.mes,
                              c.campo,
                              e.target.value === '' ? null : Number(e.target.value),
                            )
                          }
                          className={`value w-16 rounded border px-1 py-0.5 text-right ${
                            editado
                              ? 'border-ui-accent bg-ui-panel-2 font-semibold'
                              : 'border-transparent bg-transparent hover:border-ui-border'
                          }`}
                          aria-label={`${c.etiqueta} de ${m.nombre}`}
                        />
                        <button
                          className={`w-3 text-ui-ink-muted hover:text-ui-ink ${editado ? '' : 'invisible'}`}
                          onClick={() => climate.setValor(m.mes, c.campo, null)}
                          aria-label={`Restablecer ${c.etiqueta} de ${m.nombre}`}
                          title="Volver al valor calculado"
                        >
                          ↺
                        </button>
                      </span>
                    </td>
                  );
                })}
                <td className="value pl-1 text-right text-ui-ink">
                  {balance > 0 ? '+' : ''}
                  {balance.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-2xs text-ui-ink-muted">
        Celdas resaltadas = editadas a mano (tienen prioridad sobre los modificadores). ↺ restablece el valor
        calculado.
      </p>
    </div>
  );
}
