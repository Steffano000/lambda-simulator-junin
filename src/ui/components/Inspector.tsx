/** Paso 01 · Inspección de celda: estado lógico del TileNode, su suelo y su cultivo. */
import { container } from '@/app/container';
import { useController } from '@/controllers/hooks';
import { useSelectedTile, useSimStore } from '@/store/useSimStore';
import { soilColor, stageColor } from '@/theme/ramps';

const ESTADOS = {
  baldio: 'Baldío',
  arado: 'Arado',
  sembrado: 'Sembrado',
  maduro: 'Maduro',
  cosechado: 'Cosechado',
} as const;

const ETAPAS = {
  siembra: 'Siembra',
  germinacion: 'Germinación',
  desarrollo: 'Desarrollo',
  media: 'Media',
  final: 'Final',
  cosecha: 'Ciclo completo',
} as const;

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
  const controller = useController();
  const tile = useSelectedTile();
  const herramienta = useSimStore((s) => s.herramienta);
  // Re-evaluar el aviso de la herramienta al cambiar cultivo, escenario o calendario
  useSimStore((s) => `${s.cultivo}|${s.escenario}|${s.mesInicio}|${s.dia}`);
  if (!tile) return null;

  const terreno = container.soilOf(tile.suelo.clase);
  const crop = container.crops.find(tile.vegetacionId);
  const etapa = crop?.etapaEn(tile.diasCultivo);
  const aviso =
    herramienta !== 'inspeccionar'
      ? {
          motivo: controller.checkTool(herramienta, tile),
          etiqueta: container.commands.create(herramienta).etiqueta,
        }
      : null;

  return (
    <aside
      aria-label="Inspector de celda"
      className="panel absolute top-4 right-4 z-inspector max-h-[calc(100%-2rem)] w-inspector animate-panel-in overflow-y-auto p-4"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Celda <span className="value">{tile.id}</span>
        </h2>
        <button className="btn" onClick={() => controller.select(null)} aria-label="Cerrar inspector">
          ✕
        </button>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <span className="swatch size-4" style={{ backgroundColor: soilColor(tile.suelo.clase) }} />
        <span className="text-xs font-medium">{tile.suelo.clase}</span>
        {terreno && <span className="text-2xs text-ui-ink-muted">({terreno.clase_en})</span>}
      </div>

      {aviso?.motivo && (
        <p className="mb-3 rounded-md bg-ui-panel-2 px-2 py-1.5 text-2xs text-ui-ink-muted">
          <strong className="text-ui-ink">{aviso.etiqueta}</strong> no aplica aquí: {aviso.motivo}
        </p>
      )}

      <dl>
        <Row label="Estado" value={tile.canal ? 'Canal de riego' : ESTADOS[tile.estado]} />
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
      </dl>

      {crop && etapa && (
        <div className="mt-3 rounded-md bg-ui-panel-2 p-2.5">
          <div className="mb-1 flex items-center gap-2">
            <span className="swatch" style={{ backgroundColor: stageColor(etapa) }} />
            <span className="text-xs font-medium">{crop.nombre}</span>
            <span className="text-2xs text-ui-ink-muted">{ETAPAS[etapa]}</span>
          </div>
          <div className="text-2xs text-ui-ink-muted">
            Día <span className="value">{tile.diasCultivo}</span> de {crop.cicloDias} · cosechable desde el
            día {crop.inicioFinal}
          </div>
        </div>
      )}
    </aside>
  );
}
