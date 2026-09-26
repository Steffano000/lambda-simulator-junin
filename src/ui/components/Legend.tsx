/**
 * Leyenda obligatoria y visible de la capa activa (design.md §2, WCAG):
 * el color nunca es el único canal, siempre va con etiqueta.
 */
import { useSimStore, type Overlay } from '@/store/useSimStore';
import { chiColor, humidityColor, phColor, soilColor, stageColor } from '@/theme/ramps';
import { surface, tokens } from '@/theme/tokens';

interface Item {
  label: string;
  color: string;
  borde?: boolean;
}

const legends: Record<Exclude<Overlay, 'suelo'>, { title: string; items: Item[] }> = {
  humedad: {
    title: 'Humedad (% entre PMP y CC)',
    items: [0, 25, 50, 75, 100].map((v) => ({ label: `${v} %`, color: humidityColor(v) })),
  },
  ph: {
    title: 'pH del suelo',
    items: [4, 5, 6, 7, 8, 9].map((v) => ({ label: v.toFixed(1), color: phColor(v) })),
  },
  salud: {
    title: 'Salud del cultivo (CHI)',
    items: [
      { label: '100 · saludable', color: chiColor(100) },
      { label: '70 · estresado', color: chiColor(70) },
      { label: '35 · crítico', color: chiColor(35) },
      { label: '0 · perdido', color: chiColor(0) },
    ],
  },
};

const etapas: Item[] = [
  { label: 'Siembra', color: stageColor('siembra') },
  { label: 'Germinación (inicial)', color: stageColor('germinacion') },
  { label: 'Desarrollo', color: stageColor('desarrollo') },
  { label: 'Media', color: stageColor('media') },
  { label: 'Final (cosechable)', color: stageColor('final') },
  { label: 'Ciclo completo', color: stageColor('cosecha') },
  { label: 'Planta muerta', color: surface.roca },
];

const marcas: Item[] = [
  { label: 'Seleccionada', color: '#FFFFFF', borde: true },
  { label: 'No cumple requisitos', color: tokens.chi[25], borde: true },
];

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <div>
      <h2 className="mb-1.5 text-xs font-semibold text-ui-ink">{title}</h2>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-2xs text-ui-ink-muted">
            <span
              className="swatch"
              style={
                item.borde ? { boxShadow: `inset 0 0 0 2px ${item.color}` } : { backgroundColor: item.color }
              }
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend() {
  const overlay = useSimStore((s) => s.overlay);
  const clase = useSimStore((s) => s.tiles[0]?.suelo.clase ?? '');
  const hayCultivos = useSimStore((s) => s.tiles.some((t) => t.vegetacionId !== null));
  const hayCanal = useSimStore((s) => s.tiles.some((t) => t.canal));

  const base =
    overlay === 'suelo'
      ? { title: 'Suelo', items: [{ label: `${clase} · baldío`, color: soilColor(clase) }] }
      : legends[overlay];
  const items = hayCanal ? [...base.items, { label: 'Canal de riego', color: surface.agua }] : base.items;

  return (
    <section aria-label="Leyenda" className="panel absolute bottom-4 left-4 z-legend w-52 space-y-2.5 p-3">
      <Group title={base.title} items={items} />
      {overlay === 'suelo' && (
        <p className="text-2xs text-ui-ink-muted">Las celdas aradas se ven más bajas (surcos).</p>
      )}
      {hayCultivos && <Group title="Etapa del cultivo" items={etapas} />}
      <Group title="Marcas" items={marcas} />
    </section>
  );
}
