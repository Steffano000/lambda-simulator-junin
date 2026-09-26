/** Herramienta sugerida como chip: icono + nombre (el icono nunca va solo). */
import { container } from '@/app/container';
import type { ToolId } from '@/domain/actions';
import { ToolIcon } from './CropIcon';

export function ToolChip({ tool }: { tool: ToolId }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-ui-panel-2 px-1.5 py-0.5 text-ui-ink">
      <ToolIcon tool={tool} className="text-xs" />
      {container.commands.create(tool).etiqueta}
    </span>
  );
}

export function ToolChips({ tools }: { tools: readonly ToolId[] }) {
  if (tools.length === 0) return <span>—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {tools.map((t) => (
        <ToolChip key={t} tool={t} />
      ))}
    </span>
  );
}
