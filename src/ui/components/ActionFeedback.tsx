/** Resultado de la última acción: éxito o motivo del bloqueo (docs/02 · Validación 1). */
import { useSimStore } from '@/store/useSimStore';

export function ActionFeedback() {
  const mensaje = useSimStore((s) => s.mensaje);
  if (!mensaje) return null;

  const error = mensaje.tipo === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`panel absolute top-4 left-1/2 z-hud max-w-md -translate-x-1/2 animate-panel-in px-3 py-2 text-xs ${
        error ? 'border-ui-danger text-ui-danger' : 'text-ui-ink'
      }`}
    >
      {mensaje.texto}
    </div>
  );
}
