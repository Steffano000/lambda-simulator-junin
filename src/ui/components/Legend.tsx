/**
 * Leyenda obligatoria y visible del overlay activo (design.md §2, WCAG):
 * el color nunca es el único canal, siempre va con etiqueta.
 */
import { SoilRepository } from '@/data';
import { useSimStore, type Overlay } from '@/store/useSimStore';
import { humidityColor, phColor, soilColor } from '@/theme/ramps';

const legends: Record<Overlay, { title: string; items: { label: string; color: string }[] }> = {
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

export function Legend() {
  const overlay = useSimStore((s) => s.overlay);
  const { title, items } = legends[overlay];

  return (
    <section aria-label="Leyenda" className="panel absolute bottom-4 left-4 z-legend w-56 p-3">
      <h2 className="mb-2 text-xs font-semibold text-ui-ink">{title}</h2>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-2xs text-ui-ink-muted">
            <span className="swatch" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
