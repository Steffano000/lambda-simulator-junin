/**
 * Pasos 2–3 · Panel de acciones según el estado del terreno y aplicación por área.
 * Solo se muestran las acciones que corresponden al terreno y a su estado actual.
 */
import { container } from '@/app/container';
import { useControllers, useDisponibles, useNecesidades } from '@/controllers/hooks';
import type { OrientacionSurco } from '@/domain/grid';
import { useSimStore } from '@/store/useSimStore';
import { Section } from '../panels/Section';
import { ActionCard } from './ActionCard';
import { CorrectionBanner } from './CorrectionBanner';

/** Surcos a lo largo de las columnas (X, este–oeste) o de las filas (Z, norte–sur). */
const DIRECCIONES: { id: OrientacionSurco; label: string; flecha: string }[] = [
  { id: 'x', label: 'Este–Oeste', flecha: '↔' },
  { id: 'z', label: 'Norte–Sur', flecha: '↕' },
];

export function TreatmentStep() {
  const { terrain, treatment, planting, selection } = useControllers();
  const terreno = useSimStore((s) => s.terreno);
  const herramienta = useSimStore((s) => s.herramienta);
  const direccion = useSimStore((s) => s.direccionArado);
  const seleccion = useSimStore((s) => s.seleccion);
  const correccion = useSimStore((s) => s.correccion);
  const hayTratadas = useSimStore((s) => s.tiles.some((t) => t.estado === 'arado'));
  const disponibles = useDisponibles();
  const necesidades = useNecesidades();
  const aptos = planting.aptos();
  if (!terreno) return null;

  const ocultas = container.commands.ids('tratamiento').length - disponibles.length;
  const activa = disponibles.find((d) => d.id === herramienta);
  const aplicables = activa ? treatment.aplicablesEnSeleccion(activa.id) : 0;

  return (
    <>
      <Section titulo="Terreno">
        <p className="text-xs">{terreno.descripcion}</p>
        <button className="btn mt-2" onClick={() => terrain.reset()}>
          Cambiar terreno
        </button>
      </Section>

      {correccion && <CorrectionBanner />}

      <Section titulo="Acciones disponibles">
        <ul className="space-y-1">
          {disponibles.map((d) => (
            <li key={d.id}>
              <ActionCard
                command={d.command}
                activa={herramienta === d.id}
                aplicables={d.aplicables}
                sirvePara={treatment.sirvePara(d.id, aptos)}
                necesariaPara={necesidades.get(d.id) ?? []}
                onSelect={() => treatment.selectTool(herramienta === d.id ? null : d.id)}
              />
            </li>
          ))}
        </ul>
        {ocultas > 0 && (
          <p className="mt-2 text-2xs text-ui-ink-muted">
            {ocultas} acción(es) oculta(s): no corresponden a este terreno o a su estado actual.
          </p>
        )}
      </Section>

      <Section titulo="Aplicar">
        <p className="mb-2 text-2xs text-ui-ink-muted">
          Clic en una celda o arrastra para seleccionar un área. Clic derecho para girar la cámara.
        </p>
        <div className="mb-2 flex items-baseline justify-between text-xs">
          <span>
            <span className="value font-semibold">{seleccion.length}</span> celda(s) seleccionada(s)
          </span>
          {seleccion.length > 0 && (
            <button className="text-2xs text-ui-ink-muted underline" onClick={() => selection.clear()}>
              Limpiar
            </button>
          )}
        </div>
        {herramienta === 'arar' && (
          <div role="radiogroup" aria-label="Dirección de los surcos" className="mb-2">
            <p className="mb-1 text-2xs font-medium text-ui-ink">Dirección de los surcos</p>
            <div className="grid grid-cols-2 gap-1">
              {DIRECCIONES.map((d) => (
                <button
                  key={d.id}
                  role="radio"
                  aria-checked={direccion === d.id}
                  className={`btn justify-center ${direccion === d.id ? 'btn-active' : ''}`}
                  onClick={() => treatment.setDireccionArado(d.id)}
                >
                  <span aria-hidden className="text-sm">
                    {d.flecha}
                  </span>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {activa && seleccion.length > 0 && (
          <p className="mb-2 text-2xs text-ui-ink-muted">
            {activa.command.etiqueta} aplica en <span className="value text-ui-ink">{aplicables}</span> de{' '}
            {seleccion.length}; el resto se omite con su motivo.
          </p>
        )}
        <button
          className="btn btn-active w-full justify-center py-2"
          disabled={!activa || seleccion.length === 0}
          onClick={() => treatment.apply()}
        >
          {activa ? `Aplicar ${activa.command.etiqueta}` : 'Elige una acción'}
        </button>
      </Section>

      {!correccion && (
        <Section titulo="Siguiente">
          <button
            className="btn w-full justify-center py-2"
            disabled={!hayTratadas}
            onClick={() => treatment.goToCrops()}
          >
            Ver cultivos disponibles →
          </button>
          {!hayTratadas && (
            <p className="mt-1 text-2xs text-ui-ink-muted">
              Ara al menos un área para habilitar los cultivos.
            </p>
          )}
        </Section>
      )}
    </>
  );
}
