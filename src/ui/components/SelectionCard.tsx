/**
 * Inspección de la selección: detalle completo si es una celda; resumen (rangos y
 * estados) si es un área. Incluye el motivo por el que la celda no cumple el cultivo.
 */
import { container } from '@/app/container';
import { useControllers, useValidacion } from '@/controllers/hooks';
import type { TileNode } from '@/domain/grid';
import { useSimStore } from '@/store/useSimStore';
import { soilColor, stageColor } from '@/theme/ramps';
import { IconClose } from './icons';

const ESTADOS = {
  baldio: 'Baldío',
  arado: 'Arado',
  sembrado: 'Sembrado',
  maduro: 'Maduro',
  cosechado: 'Cosechado',
} as const;

function Row({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ui-border py-1 last:border-0">
      <dt className="text-2xs text-ui-ink-muted">{label}</dt>
      <dd className="value text-ui-ink">
        {value}
        {unit && <span className="ml-1 text-ui-ink-muted">{unit}</span>}
      </dd>
    </div>
  );
}

const rango = (xs: number[], dec = 0) => {
  const [a, b] = [Math.min(...xs), Math.max(...xs)];
  return a === b ? a.toFixed(dec) : `${a.toFixed(dec)}–${b.toFixed(dec)}`;
};

function Detalle({ tile }: { tile: TileNode }) {
  const validacion = useValidacion();
  const terreno = container.soilOf(tile.suelo.clase);
  const crop = container.crops.find(tile.vegetacionId);
  const motivo = validacion?.motivoPorCelda[tile.id];

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span className="swatch" style={{ backgroundColor: soilColor(tile.suelo.clase) }} />
        <span className="text-xs font-medium">{tile.suelo.clase}</span>
      </div>
      {motivo && (
        <p className="mb-2 rounded-md bg-ui-panel-2 px-2 py-1 text-2xs text-chi-critico">
          {validacion?.cultivo}: {motivo}
        </p>
      )}
      <dl>
        <Row label="Estado" value={tile.canal ? 'Canal de riego' : ESTADOS[tile.estado]} />
        <Row label="Humedad" value={tile.humedad} unit="%" />
        <Row label="pH" value={tile.suelo.ph.toFixed(1)} />
        <Row label="N · P · K" value={`${tile.suelo.n} · ${tile.suelo.p} · ${tile.suelo.k}`} unit="ppm" />
        <Row label="Materia orgánica" value={tile.suelo.materiaOrganica} unit="%" />
        {terreno && <Row label="Agua útil" value={terreno.agua_util_mm_m} unit="mm/m" />}
      </dl>
      {crop && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-ui-panel-2 p-2 text-2xs">
          <span className="swatch" style={{ backgroundColor: stageColor(crop.etapaEn(tile.diasCultivo)) }} />
          <span className="font-medium">{crop.nombre}</span>
          <span className="text-ui-ink-muted">
            día {tile.diasCultivo} · salud {Math.round(tile.salud)}
          </span>
        </div>
      )}
    </>
  );
}

function Resumen({ tiles }: { tiles: TileNode[] }) {
  const conteo = new Map<string, number>();
  for (const t of tiles) {
    const k = t.canal ? 'Canal' : ESTADOS[t.estado];
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return (
    <dl>
      <Row label="Estados" value={[...conteo].map(([k, n]) => `${k} ${n}`).join(' · ')} />
      <Row label="Humedad" value={rango(tiles.map((t) => t.humedad))} unit="%" />
      <Row
        label="pH"
        value={rango(
          tiles.map((t) => t.suelo.ph),
          1,
        )}
      />
      <Row label="N" value={rango(tiles.map((t) => t.suelo.n))} unit="ppm" />
      <Row
        label="Materia orgánica"
        value={rango(
          tiles.map((t) => t.suelo.materiaOrganica),
          1,
        )}
        unit="%"
      />
    </dl>
  );
}

export function SelectionCard() {
  const { selection } = useControllers();
  const seleccion = useSimStore((s) => s.seleccion);
  const tiles = useSimStore((s) => s.tiles);
  if (seleccion.length === 0) return null;

  const ids = new Set(seleccion);
  const elegidas = tiles.filter((t) => ids.has(t.id));
  if (elegidas.length === 0) return null;

  return (
    <aside
      aria-label="Selección"
      className="panel absolute top-4 left-4 z-inspector w-64 animate-panel-in p-3"
    >
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold">
          {elegidas.length === 1 ? (
            <>
              Celda <span className="value">{elegidas[0].id}</span>
            </>
          ) : (
            `${elegidas.length} celdas`
          )}
        </h2>
        <button className="btn px-1.5" onClick={() => selection.clear()} aria-label="Limpiar selección">
          <IconClose />
        </button>
      </header>
      {elegidas.length === 1 ? <Detalle tile={elegidas[0]} /> : <Resumen tiles={elegidas} />}
    </aside>
  );
}
