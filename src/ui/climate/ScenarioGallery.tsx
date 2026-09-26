/** Galería de escenarios seleccionables: reales y personalizados, con su perfil hídrico anual. */
import { useState } from 'react';
import { useControllers, useEscenarios } from '@/controllers/hooks';
import type { ClimateScenario } from '@/domain/climate';
import { useSimStore } from '@/store/useSimStore';
import { IconCheck } from '../components/icons';
import { WaterChart } from './charts/WaterChart';
import { descargarJson } from './download';

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-ui-ink-muted">{label}</dt>
      <dd className="value text-ui-ink">{valor}</dd>
    </div>
  );
}

function ScenarioCard({ e, activo }: { e: ClimateScenario; activo: boolean }) {
  const { climate } = useControllers();
  // Eliminar no se puede deshacer: pide un segundo clic
  const [confirmar, setConfirmar] = useState(false);
  const r = e.resumen;

  return (
    <li
      className={`flex flex-col rounded-lg border p-3 transition-colors ${
        activo ? 'border-ui-accent bg-ui-panel-2' : 'border-ui-border'
      }`}
    >
      <header className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold">{e.nombre}</h3>
          <p className="text-2xs text-ui-ink-muted">
            {e.personalizado ? `Personalizado${e.base ? ` · base ${e.base}` : ''}` : 'Real · estación Huayao'}
          </p>
        </div>
        {activo && (
          <span className="flex items-center gap-1 text-2xs font-medium text-ui-accent">
            <IconCheck /> Activo
          </span>
        )}
      </header>

      <WaterChart meses={e.meses} alto={70} compacto titulo={`Lluvia y ET0 de ${e.nombre}`} />

      <dl className="mt-2 grid grid-cols-3 gap-1 text-2xs">
        <Dato label="Lluvia/año" valor={`${Math.round(r.lluviaAnual)} mm`} />
        <Dato label="ET0/año" valor={`${Math.round(r.et0Anual)} mm`} />
        <Dato label="Balance" valor={`${Math.round(r.balanceAnual)} mm`} />
        <Dato label="Meses déficit" valor={`${r.mesesDeficit} de 12`} />
        <Dato label="T mín. más baja" valor={`${r.tminMin} °C`} />
        <Dato label="T media" valor={`${r.tmedMedia.toFixed(1)} °C`} />
      </dl>

      <div className="mt-3 flex flex-wrap gap-1">
        <button
          className={`btn ${activo ? '' : 'btn-active'}`}
          disabled={activo}
          onClick={() => climate.select(e.nombre)}
        >
          {activo ? 'En uso' : 'Usar escenario'}
        </button>
        <button className="btn" onClick={() => climate.startDraft(e.nombre)}>
          Crear variante
        </button>
        {e.personalizado && (
          <>
            <button className="btn" onClick={() => climate.edit(e.nombre)}>
              Editar
            </button>
            <button
              className="btn"
              onClick={() => descargarJson(climate.exportar([e.nombre]), `clima-${e.nombre}.json`)}
            >
              Exportar
            </button>
            {confirmar ? (
              <>
                <button
                  className="btn border-ui-danger text-ui-danger"
                  onClick={() => climate.remove(e.nombre)}
                >
                  Confirmar eliminación
                </button>
                <button className="btn" onClick={() => setConfirmar(false)}>
                  No
                </button>
              </>
            ) : (
              <button className="btn text-ui-danger" onClick={() => setConfirmar(true)}>
                Eliminar
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function ScenarioGallery() {
  const escenarios = useEscenarios();
  const activo = useSimStore((s) => s.escenario);
  const reales = escenarios.filter((e) => !e.personalizado);
  const propios = escenarios.filter((e) => e.personalizado);

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">
          Escenarios reales ({reales.length})
        </h3>
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {reales.map((e) => (
            <ScenarioCard key={e.nombre} e={e} activo={e.nombre === activo} />
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">
          Personalizados ({propios.length})
        </h3>
        {propios.length ? (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {propios.map((e) => (
              <ScenarioCard key={e.nombre} e={e} activo={e.nombre === activo} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ui-ink-muted">
            Aún no hay escenarios propios. Usa "Crear variante" o la pestaña Sandbox climático.
          </p>
        )}
      </section>
    </div>
  );
}
