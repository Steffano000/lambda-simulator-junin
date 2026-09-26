/**
 * Distribución: flujo de trabajo a la izquierda (según la fase), escena al centro con
 * controles de tiempo, y a la derecha los paneles únicos de ambiente y plantaciones.
 */
import type { ReactNode } from 'react';
import { useSimStore } from '@/store/useSimStore';
import { Toolbar } from '../components/Toolbar';
import { EnvironmentPanel } from '../panels/EnvironmentPanel';
import { PlantationPanel } from '../panels/PlantationPanel';
import { CropStep } from '../steps/CropStep';
import { HarvestStep } from '../steps/HarvestStep';
import { TerrainStep } from '../steps/TerrainStep';
import { TreatmentStep } from '../steps/TreatmentStep';

const PASOS = {
  terreno: TerrainStep,
  tratamiento: TreatmentStep,
  cultivos: CropStep,
  cosecha: HarvestStep,
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const fase = useSimStore((s) => s.fase);
  const terreno = useSimStore((s) => s.terreno);
  const Paso = PASOS[fase];

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Flujo de trabajo"
          className="w-72 shrink-0 overflow-y-auto border-r border-ui-border bg-ui-panel"
        >
          <Paso />
        </aside>
        <main className="relative min-w-0 flex-1">{children}</main>
        {terreno && (
          <aside
            aria-label="Ambiente y plantaciones"
            className="w-80 shrink-0 overflow-y-auto border-l border-ui-border bg-ui-panel"
          >
            <EnvironmentPanel />
            <PlantationPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
