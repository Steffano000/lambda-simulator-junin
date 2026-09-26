/**
 * Leyenda obligatoria y visible del overlay activo (design.md §2, WCAG):
 * el color nunca es el único canal, siempre va con etiqueta.
 */
import { SoilRepository } from '@/data';
import { useSimStore, type Overlay } from '@/store/useSimStore';
import { humidityColor, phColor, soilColor, stageColor } from '@/theme/ramps';
import { surface } from '@/theme/tokens';

interface Item {
  label: string;
  color: string;
}

const legends: Record<Overlay, { title: string; items: Item[] }> = {
  suelo: {
    title: 'Clase de suelo',
    items: SoilRepository.all().map((t) => ({ label: t.clase, color: soilColor(t.clase) })),
  },
  humedad: {
    title: 'Humedad (% entre PMP y CC)',
    items: [0, 25, 50, 75, 100].map((v) => ({ label: `${v} %`, color: humidityColor(v) })),
  },
  ph: {
    title: 'pH del suelo',
    items: [4, 5, 6, 7, 8, 9].map((v) => ({ label: v.toFixed(1), color: phColor(v) })),
  },
};

const etapas: Item[] = [
  { label: 'Siembra', color: stageColor('siembra') },
  { label: 'Germinación (inicial)', color: stageColor('germinacion') },
  { label: 'Desarrollo', color: stageColor('desarrollo') },
  { label: 'Media', color: stageColor('media') },
  { label: 'Final (cosechable)', color: stageColor('final') },
  { label: 'Ciclo completo', color: stageColor('cosecha') },
];

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold text-ui-ink">{title}</h2>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-2xs text-ui-ink-muted">
            <span className="swatch" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend() {
  const overlay = useSimStore((s) => s.overlay);
  const hayCultivos = useSimStore((s) => s.tiles.some((t) => t.vegetacionId !== null));
  const hayCanal = useSimStore((s) => s.tiles.some((t) => t.canal));
  const { title, items } = legends[overlay];

  return (
    <section aria-label="Leyenda" className="panel absolute bottom-4 left-4 z-legend w-56 space-y-3 p-3">
      <Group
        title={title}
        items={hayCanal ? [...items, { label: 'Canal de riego', color: surface.agua }] : items}
      />
      {hayCultivos && <Group title="Etapa del cultivo" items={etapas} />}
    </section>
  );
}
