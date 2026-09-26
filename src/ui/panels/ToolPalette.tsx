/** Paso 02 · Paleta de herramientas (Strategy: la herramienta activa decide qué hace el clic). */
import { container } from '@/app/container';
import { useController } from '@/controllers/hooks';
import { TOOL_IDS } from '@/domain/actions';
import { useSimStore, type ActiveTool } from '@/store/useSimStore';
import { Section } from './Section';

const tools: { id: ActiveTool; etiqueta: string }[] = [
  { id: 'inspeccionar', etiqueta: 'Inspeccionar' },
  ...TOOL_IDS.map((id) => ({ id, etiqueta: container.commands.create(id).etiqueta })),
];

export function ToolPalette() {
  const controller = useController();
  const herramienta = useSimStore((s) => s.herramienta);

  return (
    <Section titulo="Herramientas">
      <div role="radiogroup" aria-label="Herramienta" className="grid grid-cols-2 gap-1">
        {tools.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={herramienta === t.id}
            className={`btn justify-center ${herramienta === t.id ? 'btn-active' : ''}`}
            onClick={() => controller.selectTool(t.id)}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>
      <p className="mt-2 text-2xs text-ui-ink-muted">
        {herramienta === 'inspeccionar'
          ? 'Haz clic en una celda para ver sus datos.'
          : 'Haz clic en una celda para aplicar la herramienta.'}
      </p>
    </Section>
  );
}
