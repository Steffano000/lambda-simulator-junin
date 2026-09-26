/**
 * Pasos 4–7 · Cultivos disponibles según el terreno tratado, validación de requisitos
 * por celda, corrección (volver a tratamientos) y plantación.
 */
import { useMemo } from 'react';
import { useControllers, useMesActual, useValidacion } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import { useSimStore } from '@/store/useSimStore';
import { IconBack } from '../components/icons';
import { Section } from '../panels/Section';
import { ValidationReport } from './ValidationReport';

export function CropStep() {
  const { planting, treatment } = useControllers();
  const cultivo = useSimStore((s) => s.cultivo);
  const tiles = useSimStore((s) => s.tiles);
  const seleccion = useSimStore((s) => s.seleccion);
  const escenario = useSimStore((s) => s.escenario);
  const mes = useMesActual();
  const validacion = useValidacion();
  const aptos = planting.aptos();
  const noAptos = planting.noAptos();

  // Disponibilidad de cada cultivo apto sobre las celdas candidatas
  const resumen = useMemo(
    () => new Map(aptos.map((c) => [c.nombre, planting.validar(c.nombre)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tiles, seleccion, escenario, mes],
  );
  const candidatas = planting.candidatas().length;

  return (
    <>
      <Section titulo="Cultivos disponibles">
        <p className="mb-2 text-2xs text-ui-ink-muted">
          {seleccion.length
            ? `Evaluando las ${seleccion.length} celdas seleccionadas.`
            : `Evaluando las ${candidatas} celdas tratadas (aradas y libres). Selecciona un área para limitarla.`}
        </p>
        <ul className="space-y-1" role="radiogroup" aria-label="Cultivo">
          {aptos.map((crop) => {
            const v = resumen.get(crop.nombre);
            const activo = cultivo === crop.nombre;
            const bloqueado = (v?.bloqueosCultivo.length ?? 0) > 0;
            return (
              <li key={crop.nombre}>
                <button
                  role="radio"
                  aria-checked={activo}
                  aria-label={crop.nombre}
                  onClick={() => planting.selectCrop(activo ? null : crop.nombre)}
                  className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                    activo ? 'border-ui-accent bg-ui-panel-2' : 'border-ui-border hover:bg-ui-panel-2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{crop.nombre}</span>
                    {bloqueado ? (
                      <span className="rounded bg-chi-estresado/15 px-1.5 text-2xs text-ui-ink-muted">
                        Siembra en {MESES[crop.datos.mes_siembra - 1]}
                      </span>
                    ) : (
                      <span className="value text-2xs">
                        <span className="text-chi-saludable">{v?.listas.length ?? 0} listas</span>
                        {v && v.aCorregir.length > 0 && (
                          <span className="text-ui-ink-muted"> · {v.aCorregir.length} por tratar</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-2xs text-ui-ink-muted">
                    {crop.datos.variedad} · {crop.cicloDias} días · {crop.datos.rendimiento_junin_2025} t/ha
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {noAptos.length > 0 && (
          <details className="mt-2 text-2xs text-ui-ink-muted">
            <summary className="cursor-pointer">{noAptos.length} no apto(s) para esta textura</summary>
            <ul className="mt-1 list-disc pl-4">
              {noAptos.map((c) => (
                <li key={c.nombre}>
                  {c.nombre}: prefiere {c.datos.textura_preferida}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      {cultivo && validacion && <ValidationReport validacion={validacion} />}

      <Section titulo="Volver">
        <button className="btn w-full justify-center" onClick={() => treatment.goToTreatments()}>
          <IconBack /> Acciones y tratamientos
        </button>
      </Section>
    </>
  );
}
