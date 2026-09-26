/**
 * Panel del CULTIVO de la celda: cómo se ve hoy, etapa y avance del ciclo, salud, agua
 * para el cultivo, qué lo afecta hoy y la cosecha estimada.
 */
import { useMemo } from 'react';
import { useDetalleCultivo } from '@/controllers/hooks';
import type { EtapaVisual } from '@/domain/crops';
import type { TileNode } from '@/domain/grid';
import type { EfectoHidrico } from '@/domain/hydrology';
import { GrowthStrip } from '@/scene/preview';
import { chiColor, humidityColor, soilColor, stageColor } from '@/theme/ramps';
import { CropIcon } from '../icons/CropIcon';
import { VARIABLE_CLIMA } from '../icons';
import { Barra, Fila, Grupo, PanelSeleccion } from './parts';

const ETAPAS: EtapaVisual[] = ['siembra', 'germinacion', 'desarrollo', 'media', 'final', 'cosecha'];

const ETIQUETA_ETAPA: Record<EtapaVisual, string> = {
  siembra: 'Siembra',
  germinacion: 'Germinación',
  desarrollo: 'Desarrollo',
  media: 'Media',
  final: 'Final',
  cosecha: 'Ciclo completo',
};

const SALUD = {
  saludable: 'Saludable',
  estresado: 'Estresada',
  critico: 'Crítica',
  muerto: 'Muerta',
} as const;

const EFECTO: Record<EfectoHidrico, { texto: string; tono: string }> = {
  deficit: { texto: 'Déficit: crece más lento', tono: 'text-chi-estresado' },
  adecuado: { texto: 'Adecuada', tono: 'text-chi-saludable' },
  exceso: { texto: 'Exceso de humedad', tono: 'text-chi-estresado' },
  encharcado: { texto: 'Encharcada', tono: 'text-chi-critico' },
};

export function CropPanel({ tile }: { tile: TileNode }) {
  const d = useDetalleCultivo(tile);
  const etapas = useMemo(
    () =>
      d
        ? [
            {
              etiqueta: 'Hoy',
              estado: { etapa: d.etapa, progreso: d.progreso, salud: d.salud, muerta: d.muerta },
            },
          ]
        : [],
    [d],
  );
  if (!d) return null;

  return (
    <PanelSeleccion
      etiqueta={`Información del cultivo ${d.cultivo}`}
      titulo={d.cultivo}
      subtitulo={`${d.variedad}${d.plantacionId ? ` · plantación ${d.plantacionId}` : ''}`}
      icono={<CropIcon nombre={d.cultivo} />}
    >
      <div className="mb-2 rounded-md bg-ui-panel-2">
        <GrowthStrip
          cultivo={d.cultivo}
          etapas={etapas}
          suelo={soilColor(tile.suelo.clase)}
          className="!h-28 w-full"
        />
      </div>

      <Grupo titulo="Desarrollo">
        <Fila
          label="Etapa"
          value={
            <span className="inline-flex items-center gap-1">
              <span className="swatch" style={{ backgroundColor: stageColor(d.etapa) }} />
              {ETIQUETA_ETAPA[d.etapa]}
            </span>
          }
        />
        {/* Línea del ciclo: una franja por etapa y marca del avance actual */}
        <div className="relative my-1.5 flex h-2 gap-px overflow-hidden rounded-full" aria-hidden>
          {ETAPAS.slice(1, 5).map((e) => (
            <div key={e} className="flex-1" style={{ backgroundColor: stageColor(e), opacity: 0.8 }} />
          ))}
          <div className="absolute inset-y-0 w-0.5 bg-ui-ink" style={{ left: `${d.progreso * 100}%` }} />
        </div>
        <Fila label="Días de desarrollo" value={`${Math.floor(d.diasDesarrollo)} de ${d.cicloDias}`} />
        {d.diasDesdeSiembra !== null && <Fila label="Días desde la siembra" value={d.diasDesdeSiembra} />}
        <Fila
          label="Cosecha"
          value={
            d.muerta
              ? 'Planta muerta'
              : d.maduro
                ? 'Lista para cosechar'
                : `faltan ${d.faltanParaCosecha} días`
          }
        />
      </Grupo>

      <Grupo titulo="Salud">
        <Fila label="Índice (CHI)" value={`${Math.round(d.salud)} · ${SALUD[d.estadoSalud]}`} />
        <Barra valor={d.salud} color={chiColor(d.salud)} />
      </Grupo>

      <Grupo titulo="Agua para el cultivo">
        <Fila
          label="Hidratación"
          value={<span className={EFECTO[d.efectoHidrico].tono}>{EFECTO[d.efectoHidrico].texto}</span>}
        />
        <Fila label="Humedad / mínimo" value={`${Math.round(d.humedad)} / ${d.umbralHumedad}`} unit="%" />
        <Barra valor={d.humedad} color={humidityColor(d.humedad)} marca={d.umbralHumedad} />
        <Fila
          label={
            <span className="inline-flex items-center gap-1">
              <VARIABLE_CLIMA.et className="text-xs" /> Consumo hoy (ETc)
            </span>
          }
          value={d.etcHoy.toFixed(1)}
          unit={`mm · Kc ${d.kcHoy.toFixed(2)}`}
        />
        <Fila
          label={
            <span className="inline-flex items-center gap-1">
              <VARIABLE_CLIMA.lluvia className="text-xs" /> Lluvia hoy
            </span>
          }
          value={d.lluviaHoy.toFixed(1)}
          unit="mm"
        />
      </Grupo>

      <section className="mt-2.5">
        <h3 className="mb-0.5 text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">
          Hoy le afecta
        </h3>
        {d.muerta ? (
          <p className="text-2xs text-ui-ink-muted">
            La planta murió: remuévela para volver a usar la celda.
          </p>
        ) : d.efectos.length ? (
          <ul className="space-y-0.5 text-2xs text-chi-estresado">
            {d.efectos.map((e) => (
              <li key={e.id} className="flex gap-1">
                <span aria-hidden>▼</span>
                {e.descripcion}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2xs text-chi-saludable">▲ Sin estrés: la salud se recupera cada día.</p>
        )}
      </section>

      <Grupo titulo="Rendimiento">
        <Fila label="Estimado con la salud actual" value={d.rendimientoEstimadoKg.toFixed(2)} unit="kg/m²" />
        <Fila label="Referencia Junín 2025" value={d.rendimientoRefKg.toFixed(2)} unit="kg/m²" />
      </Grupo>
    </PanelSeleccion>
  );
}
