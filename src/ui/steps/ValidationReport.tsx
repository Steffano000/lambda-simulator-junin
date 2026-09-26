/**
 * Paso 4 · Validación de prerrequisitos del cultivo elegido: qué celdas están listas,
 * cuáles no y por qué. Plantar solo afecta a las listas; las demás se pueden corregir.
 */
import { container } from '@/app/container';
import type { ValidacionSiembra } from '@/domain/actions';
import { useControllers } from '@/controllers/hooks';
import { IconAlert, IconCheck } from '../components/icons';
import { Section } from '../panels/Section';

export function ValidationReport({ validacion: v }: { validacion: ValidacionSiembra }) {
  const { planting } = useControllers();
  const crop = container.crops.create(v.cultivo);
  const total = v.listas.length + v.aCorregir.length;
  const pendientes = new Map(v.pendientes.map((p) => [p.requisito.id, p]));
  const bloqueado = v.bloqueosCultivo.length > 0;

  return (
    <Section titulo={`Requisitos de ${v.cultivo}`}>
      {bloqueado && (
        <div role="alert" className="mb-2 rounded-md border border-ui-danger/50 p-2 text-2xs text-ui-danger">
          {v.bloqueosCultivo.map((b) => (
            <p key={b}>{b}</p>
          ))}
          <p className="mt-1 text-ui-ink-muted">
            Avanza el tiempo hasta el mes de siembra o cambia de escenario.
          </p>
        </div>
      )}

      <ul className="mb-3 space-y-1 text-2xs">
        {crop.requisitos.map((r) => {
          const p = pendientes.get(r.id);
          return (
            <li key={r.id} className="flex items-start gap-1.5">
              {p ? (
                <IconAlert className="mt-0.5 shrink-0 text-chi-critico" />
              ) : (
                <IconCheck className="mt-0.5 shrink-0 text-chi-saludable" />
              )}
              <span className="flex-1">
                <span className="text-ui-ink">{r.condicion}</span>
                {p && (
                  <span className="text-ui-ink-muted">
                    {' '}
                    — faltan {p.tileIds.length} celda(s) ·{' '}
                    {p.herramientas.map((h) => container.commands.create(h).etiqueta).join(' o ')}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-ui-panel-2" aria-hidden>
        <div
          className="bg-chi-saludable"
          style={{ width: `${total ? (v.listas.length / total) * 100 : 0}%` }}
        />
        <div
          className="bg-chi-critico/70"
          style={{ width: `${total ? (v.aCorregir.length / total) * 100 : 0}%` }}
        />
      </div>
      <p className="mb-3 text-2xs text-ui-ink-muted">
        <span className="value text-ui-ink">{v.listas.length}</span> listas ·{' '}
        <span className="value text-ui-ink">{v.aCorregir.length}</span> requieren tratamiento (resaltadas en
        rojo)
      </p>

      <div className="flex flex-col gap-1">
        <button
          className="btn btn-active justify-center py-2"
          disabled={bloqueado || v.listas.length === 0}
          onClick={() => planting.plant()}
        >
          Plantar en {v.listas.length} celda(s) lista(s)
        </button>
        {v.aCorregir.length > 0 && (
          <button className="btn justify-center" onClick={() => planting.correct()}>
            Corregir {v.aCorregir.length} celda(s) en tratamientos
          </button>
        )}
      </div>
    </Section>
  );
}
