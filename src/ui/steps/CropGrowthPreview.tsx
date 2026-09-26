/**
 * Fase 3 · Vista previa del cultivo elegido: cómo crece (una planta por etapa) y cómo se
 * verá al final. Opcionalmente, la plantación final translúcida sobre las celdas listas.
 */
import { useEffect, useMemo, useState } from 'react';
import { container } from '@/app/container';
import { useControllers } from '@/controllers/hooks';
import type { Crop, EtapaVisual } from '@/domain/crops';
import { GrowthStrip, type EtapaPrevia } from '@/scene/preview';
import { useSimStore } from '@/store/useSimStore';
import { soilColor, stageColor } from '@/theme/ramps';
import { IconClose } from '../components/icons';
import { CropIcon } from '../icons/CropIcon';
import { Section } from '../panels/Section';

/** Abreviaturas para la tira angosta del panel; la vista ampliada usa el nombre completo. */
const CORTA: Record<EtapaVisual, string> = {
  siembra: 'Siem.',
  germinacion: 'Germ.',
  desarrollo: 'Des.',
  media: 'Media',
  final: 'Final',
  cosecha: 'Cos.',
};

const ETIQUETA: Record<EtapaVisual, string> = {
  siembra: 'Siembra',
  germinacion: 'Germinación',
  desarrollo: 'Desarrollo',
  media: 'Media',
  final: 'Final',
  cosecha: 'Cosecha',
};

/** Día representativo de cada etapa (mitad de la etapa, según data/cultivos.json). */
function etapasDe(crop: Crop): (EtapaPrevia & { dia: number; etapa: EtapaVisual })[] {
  const d = crop.datos;
  const hitos: [EtapaVisual, number][] = [
    ['siembra', 0],
    ['germinacion', Math.round(d.dias_inicial / 2)],
    ['desarrollo', Math.round(d.dias_inicial + d.dias_desarrollo / 2)],
    ['media', Math.round(d.dias_inicial + d.dias_desarrollo + d.dias_media / 2)],
    ['final', Math.round(crop.inicioFinal + d.dias_final / 2)],
    ['cosecha', crop.cicloDias],
  ];
  return hitos.map(([etapa, dia]) => ({
    etapa,
    dia,
    etiqueta: ETIQUETA[etapa],
    estado: { etapa, progreso: dia / crop.cicloDias, salud: 100, muerta: false },
  }));
}

function Etiquetas({ etapas, cortas = false }: { etapas: ReturnType<typeof etapasDe>; cortas?: boolean }) {
  return (
    <ol className="grid grid-cols-6 gap-0.5 text-center text-[0.6rem] leading-tight">
      {etapas.map((e) => (
        <li key={e.etapa} className={e.etapa === 'final' ? 'font-semibold text-ui-ink' : 'text-ui-ink-muted'}>
          <span
            className="mx-auto mb-0.5 block h-1 w-5 rounded-full"
            style={{ backgroundColor: stageColor(e.etapa) }}
          />
          <abbr title={e.etiqueta} className="no-underline">
            {cortas ? CORTA[e.etapa] : e.etiqueta}
          </abbr>
          <span className="value block">d{e.dia}</span>
        </li>
      ))}
    </ol>
  );
}

export function CropGrowthPreview({ cultivo }: { cultivo: string }) {
  const { planting } = useControllers();
  const previa = useSimStore((s) => s.previaCultivo);
  const clase = useSimStore((s) => s.terreno?.clase ?? s.tiles[0]?.suelo.clase ?? 'Franco');
  const [ampliada, setAmpliada] = useState(false);
  const crop = container.crops.create(cultivo);
  const etapas = useMemo(() => etapasDe(crop), [crop]);
  const suelo = soilColor(clase);

  useEffect(() => {
    if (!ampliada) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAmpliada(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ampliada]);

  return (
    <Section titulo={`Así crece: ${cultivo}`}>
      <div className="relative rounded-md bg-ui-panel-2">
        <GrowthStrip cultivo={cultivo} etapas={etapas} suelo={suelo} className="!h-32 w-full" />
        <button
          className="btn absolute top-1 right-1 px-1.5 py-0.5 text-2xs"
          onClick={() => setAmpliada(true)}
          aria-label={`Ampliar la vista previa de ${cultivo}`}
        >
          Ampliar
        </button>
      </div>
      <div className="mt-1.5">
        <Etiquetas etapas={etapas} cortas />
      </div>
      <p className="mt-1.5 text-2xs text-ui-ink-muted">
        {crop.datos.variedad}: ciclo de {crop.cicloDias} días. El anillo de la base marca la etapa; el estrés
        hídrico amarillea el follaje.
      </p>
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={previa}
          onChange={() => planting.togglePrevia()}
          className="accent-[var(--ui-accent)]"
        />
        Ver la plantación final sobre las celdas listas
      </label>

      {ampliada && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAmpliada(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Crecimiento de ${cultivo}`}
            className="panel w-full max-w-4xl animate-panel-in p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-2 flex items-center gap-2">
              <CropIcon nombre={cultivo} className="text-2xl" />
              <div>
                <h2 className="text-sm font-semibold">{cultivo}: de la siembra a la cosecha</h2>
                <p className="text-2xs text-ui-ink-muted">
                  Arrastra para girar la vista · rueda para acercar.
                </p>
              </div>
              <button className="btn ml-auto px-1.5" onClick={() => setAmpliada(false)} aria-label="Cerrar">
                <IconClose />
              </button>
            </header>
            <div className="rounded-md bg-ui-panel-2">
              <GrowthStrip
                cultivo={cultivo}
                etapas={etapas}
                suelo={suelo}
                interactiva
                className="!h-[55vh] w-full"
              />
            </div>
            <div className="mt-2">
              <Etiquetas etapas={etapas} />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
