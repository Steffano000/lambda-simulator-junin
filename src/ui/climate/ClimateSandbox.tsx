/**
 * Sandbox de datos climáticos personalizables: parte de un escenario base, aplica
 * modificadores globales y ediciones por mes, compara con la base y guarda el resultado
 * como un escenario seleccionable más.
 */
import { useMemo, type ReactNode } from 'react';
import { container } from '@/app/container';
import { useControllers, useEscenarios } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { WaterChart } from './charts/WaterChart';
import { TempChart } from './charts/TempChart';
import { ImportExport } from './ImportExport';
import { ModifierControls } from './ModifierControls';
import { MonthTable } from './MonthTable';

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-ui-border p-3">
      <h3 className="mb-2 text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

export function ClimateSandbox() {
  const { climate } = useControllers();
  const borrador = useSimStore((s) => s.borrador);
  const errores = useSimStore((s) => s.erroresClima);
  const escenarios = useEscenarios();
  const meses = useMemo(() => climate.preview(borrador), [climate, borrador]);
  const avisos = useMemo(() => climate.validarBorrador(borrador), [climate, borrador]);

  if (!borrador) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <Bloque titulo="Nuevo escenario">
          <p className="mb-2 text-xs text-ui-ink-muted">
            Elige un escenario de partida y modifícalo: más o menos lluvia, más calor, un mes concreto más
            seco…
          </p>
          <div className="flex flex-wrap gap-1">
            {escenarios.map((e) => (
              <button key={e.nombre} className="btn" onClick={() => climate.startDraft(e.nombre)}>
                Partir de {e.nombre}
              </button>
            ))}
          </div>
        </Bloque>
        <Bloque titulo="Importar / exportar">
          <ImportExport />
        </Bloque>
      </div>
    );
  }

  const base = container.scenarios.existe(borrador.base) ? container.scenarios.create(borrador.base) : null;
  const mensajes = errores.length ? errores : avisos;

  return (
    <div className="grid gap-3 lg:grid-cols-[18rem_1fr]">
      <div className="space-y-3">
        <Bloque titulo={borrador.editando ? `Editando "${borrador.editando}"` : 'Nuevo escenario'}>
          <label className="mb-2 block text-xs">
            <span className="mb-1 block font-medium">Nombre</span>
            <input
              className="field"
              value={borrador.nombre}
              onChange={(e) => climate.setNombre(e.target.value)}
            />
          </label>
          {!borrador.editando && (
            <label className="block text-xs">
              <span className="mb-1 block font-medium">Escenario base</span>
              <select
                className="field"
                value={borrador.base}
                onChange={(e) => climate.setBase(e.target.value)}
              >
                {escenarios.map((e) => (
                  <option key={e.nombre} value={e.nombre}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Bloque>

        <Bloque titulo="Modificadores globales">
          <ModifierControls valores={borrador.modificadores} />
        </Bloque>

        {mensajes.length > 0 && (
          <div role="alert" className="rounded-md border border-ui-danger/50 p-2 text-2xs text-ui-danger">
            {mensajes.slice(0, 6).map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <button
            className="btn btn-active justify-center py-2"
            disabled={avisos.length > 0}
            onClick={() => climate.saveDraft(true)}
          >
            Guardar y usar
          </button>
          <button
            className="btn justify-center"
            disabled={avisos.length > 0}
            onClick={() => climate.saveDraft(false)}
          >
            Guardar sin activar
          </button>
          <div className="flex gap-1">
            <button className="btn flex-1 justify-center" onClick={() => climate.resetDraft()}>
              Restablecer
            </button>
            <button className="btn flex-1 justify-center" onClick={() => climate.cancelDraft()}>
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <Bloque titulo="Agua: lluvia y demanda (ET0)">
          <WaterChart meses={meses} base={base && !borrador.editando ? base.meses : undefined} />
        </Bloque>
        <Bloque titulo="Temperatura">
          <TempChart meses={meses} />
        </Bloque>
        <Bloque titulo="Valores mensuales">
          <MonthTable meses={meses} ediciones={borrador.ediciones} />
        </Bloque>
      </div>
    </div>
  );
}
