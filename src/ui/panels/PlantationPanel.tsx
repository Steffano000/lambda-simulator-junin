/**
 * Panel único de estado de las plantaciones: estado actual, evolución, condiciones
 * que afectan su desarrollo y acciones de cosecha/remoción.
 */
import { useMemo } from 'react';
import { container } from '@/app/container';
import { useClimaHoy, useControllers } from '@/controllers/hooks';
import type { Plantacion } from '@/domain/plantation';
import { useSimStore } from '@/store/useSimStore';
import { chiColor, stageColor } from '@/theme/ramps';
import { CropIcon } from '../icons/CropIcon';
import { Section } from './Section';
import { Sparkline } from './Sparkline';

const ETAPA = {
  siembra: 'Siembra',
  germinacion: 'Germinación',
  desarrollo: 'Desarrollo',
  media: 'Media',
  final: 'Final',
  cosecha: 'Ciclo completo',
} as const;

const ESTADO = {
  saludable: 'Saludable',
  estresado: 'Estresada',
  critico: 'Crítica',
  muerto: 'Perdida',
} as const;

const TONO = {
  favorable: 'text-chi-saludable',
  riesgo: 'text-chi-estresado',
  neutral: 'text-ui-ink-muted',
} as const;

function PlantationCard({ p }: { p: Plantacion }) {
  const { planting, harvest } = useControllers();
  const reporte = useSimStore((s) => [...s.reportes].reverse().find((x) => x.plantacionId === p.id));
  const tiles = useSimStore((s) => s.tiles);
  const dia = useSimStore((s) => s.dia);
  const terreno = useSimStore((s) => s.terreno);
  const hoy = useClimaHoy();
  const crop = container.crops.create(p.cultivo);
  const porId = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles]);
  const r = container.plantations.resumir(p, porId, crop, dia);
  const condiciones = terreno
    ? container.plantations.condiciones(
        p,
        porId,
        crop,
        { tmed: hoy.tmed, tmin: hoy.tmin, et0: hoy.et0, lluviaMm: hoy.lluvia?.mm ?? 0 },
        container.hidraulica(terreno.clase)?.saturacionPct ?? 100,
      )
    : [];

  if (r.activas === 0) {
    return (
      <li className="rounded-md border border-ui-border p-2 text-2xs text-ui-ink-muted">
        <span className="inline-flex items-center gap-1 font-medium text-ui-ink">
          <CropIcon nombre={p.cultivo} /> {p.id} · {p.cultivo}
        </span>{' '}
        — finalizada · cosechado {p.cosechadoKg.toFixed(2)} kg
        {reporte && (
          <button className="btn mt-1 w-full justify-center" onClick={() => harvest.abrir(reporte.id)}>
            Ver resumen de la recolección
          </button>
        )}
      </li>
    );
  }

  return (
    <li className="rounded-md border border-ui-border p-2.5">
      <header className="mb-1.5 flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-1.5 text-left text-xs font-semibold hover:underline"
          onClick={() => planting.selectPlantation(p.id)}
        >
          <CropIcon nombre={p.cultivo} className="text-lg" />
          {p.id} · {p.cultivo}
        </button>
        <span className="flex items-center gap-1 text-2xs font-medium">
          <span className="swatch" style={{ backgroundColor: chiColor(r.saludMedia) }} />
          {ESTADO[r.estado]}
        </span>
      </header>

      <div className="mb-2 flex items-center gap-1.5 text-2xs text-ui-ink-muted">
        <span className="swatch" style={{ backgroundColor: stageColor(r.etapa) }} />
        {ETAPA[r.etapa]} · día <span className="value text-ui-ink">{r.dias}</span> de {crop.cicloDias}
      </div>

      <dl className="mb-2 grid grid-cols-4 gap-1 text-center text-2xs">
        {[
          ['Vivas', r.vivas],
          ['Maduras', r.maduras],
          ['Muertas', r.muertas],
          ['Salud', Math.round(r.saludMedia)],
        ].map(([k, v]) => (
          <div key={k} className="rounded bg-ui-panel-2 py-1">
            <dt className="text-ui-ink-muted">{k}</dt>
            <dd className="value text-ui-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <Sparkline historial={p.historial} />

      {condiciones.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-2xs">
          {condiciones.map((c) => (
            <li key={c.texto} className={TONO[c.tipo]}>
              {c.tipo === 'favorable' ? '▲' : c.tipo === 'riesgo' ? '▼' : '•'} {c.texto}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-1">
        <button
          className="btn flex-1 justify-center"
          disabled={r.maduras === 0}
          onClick={() => harvest.harvest(p.id)}
        >
          Cosechar {r.maduras > 0 ? `(${r.maduras})` : ''}
        </button>
        <button className="btn" onClick={() => planting.remove(p.id)}>
          Remover
        </button>
      </div>
      {p.cosechadoKg > 0 && (
        <p className="mt-1 text-2xs text-ui-ink-muted">Cosechado: {p.cosechadoKg.toFixed(2)} kg</p>
      )}
    </li>
  );
}

export function PlantationPanel() {
  const plantaciones = useSimStore((s) => s.plantaciones);
  const cosechas = useSimStore((s) => s.cosechas);
  if (plantaciones.length === 0) return null;
  const total = cosechas.reduce((acc, c) => acc + c.kg, 0);

  return (
    <Section titulo={`Plantaciones (${plantaciones.length})`}>
      <ul className="space-y-2">
        {[...plantaciones].reverse().map((p) => (
          <PlantationCard key={p.id} p={p} />
        ))}
      </ul>
      {cosechas.length > 0 && (
        <p className="mt-2 text-2xs text-ui-ink-muted">
          Total cosechado <span className="value font-semibold text-ui-ink">{total.toFixed(2)} kg</span>{' '}
          (rend. ref. Junín 2025 × salud)
        </p>
      )}
    </Section>
  );
}
