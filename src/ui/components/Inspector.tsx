/** Paso 01 · Inspección de celda: datos lógicos del TileNode + parámetros de su clase de suelo. */
import { SoilRepository } from '@/data';
import { useSelectedTile, useSimStore } from '@/store/useSimStore';
import { soilColor } from '@/theme/ramps';

function Row({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ui-border py-1.5 last:border-0">
      <dt className="text-xs text-ui-ink-muted">{label}</dt>
      <dd className="value text-ui-ink">
        {value}
        {unit && <span className="ml-1 text-ui-ink-muted">{unit}</span>}
      </dd>
    </div>
  );
}

export function Inspector() {
  const tile = useSelectedTile();
  const select = useSimStore((s) => s.select);
  if (!tile) return null;

  const terreno = SoilRepository.byClass(tile.suelo.clase);

  return (
    <aside
      aria-label="Inspector de celda"
      className="panel absolute top-4 right-4 z-inspector w-inspector animate-panel-in p-4"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Celda <span className="value">{tile.id}</span>
        </h2>
        <button className="btn" onClick={() => select(null)} aria-label="Cerrar inspector">
          ✕
        </button>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <span className="swatch size-4" style={{ backgroundColor: soilColor(tile.suelo.clase) }} />
        <span className="text-xs font-medium">{tile.suelo.clase}</span>
        {terreno && <span className="text-2xs text-ui-ink-muted">({terreno.clase_en})</span>}
      </div>

      <dl>
        <Row label="Humedad" value={tile.humedad} unit="%" />
        <Row label="pH" value={tile.suelo.ph.toFixed(1)} />
        <Row label="N · P · K" value={`${tile.suelo.n} · ${tile.suelo.p} · ${tile.suelo.k}`} unit="ppm" />
        <Row label="Materia orgánica" value={tile.suelo.materiaOrganica} unit="%" />
        {terreno && (
          <>
            <Row label="CC (media)" value={terreno.cc_media} unit="m³/m³" />
            <Row label="PMP (media)" value={terreno.pmp_media} unit="m³/m³" />
            <Row label="Agua útil" value={terreno.agua_util_mm_m} unit="mm/m" />
          </>
        )}
        <Row label="Vegetación" value={tile.vegetacionId ?? '—'} />
      </dl>
    </aside>
  );
}
