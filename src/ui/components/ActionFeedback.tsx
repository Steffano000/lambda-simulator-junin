/** Resultado de la última acción: éxito, omisiones con su motivo, o bloqueo (docs/02 · Validación 1). */
import { useControllers } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { IconClose } from './icons';

export function ActionFeedback() {
  const { selection } = useControllers();
  const mensaje = useSimStore((s) => s.mensaje);
  if (!mensaje) return null;

  const error = mensaje.tipo === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`panel absolute top-4 left-1/2 z-hud flex max-w-md -translate-x-1/2 animate-panel-in gap-2 px-3 py-2 text-xs ${
        error ? 'border-ui-danger' : ''
      }`}
    >
      <div className="flex-1">
        <p className={error ? 'text-ui-danger' : 'text-ui-ink'}>{mensaje.texto}</p>
        {mensaje.detalle && mensaje.detalle.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-2xs text-ui-ink-muted">
            {mensaje.detalle.slice(0, 5).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        className="self-start text-ui-ink-muted hover:text-ui-ink"
        onClick={() => selection.dismissMessage()}
        aria-label="Cerrar mensaje"
      >
        <IconClose />
      </button>
    </div>
  );
}
