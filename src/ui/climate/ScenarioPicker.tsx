/** Selector compacto de escenario (reales y personalizados) con accesos al panel climático. */
import { useControllers, useEscenarios } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';

export function ScenarioPicker({ accesos = true }: { accesos?: boolean }) {
  const { climate } = useControllers();
  const escenario = useSimStore((s) => s.escenario);
  const escenarios = useEscenarios();
  const reales = escenarios.filter((e) => !e.personalizado);
  const propios = escenarios.filter((e) => e.personalizado);
  const etiqueta = (lluvia: number) => `${Math.round(lluvia)} mm/año`;

  return (
    <div>
      <select
        className="field"
        value={escenario}
        onChange={(e) => climate.select(e.target.value)}
        aria-label="Escenario climático"
      >
        <optgroup label="Reales">
          {reales.map((e) => (
            <option key={e.nombre} value={e.nombre}>
              {e.nombre} · {etiqueta(e.lluviaAnual)}
            </option>
          ))}
        </optgroup>
        {propios.length > 0 && (
          <optgroup label="Personalizados">
            {propios.map((e) => (
              <option key={e.nombre} value={e.nombre}>
                {e.nombre} · {etiqueta(e.lluviaAnual)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {accesos && (
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          <button className="btn justify-center" onClick={() => climate.open('escenarios')}>
            Comparar escenarios
          </button>
          <button className="btn justify-center" onClick={() => climate.startDraft()}>
            Personalizar clima
          </button>
        </div>
      )}
    </div>
  );
}
