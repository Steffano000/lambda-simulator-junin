/**
 * Modo Junín: geovisor NASA (izquierda) + simulador local (derecha).
 * Regla: lo que se VE viene de NASA en vivo; lo que se CALCULA sale de los JSON locales.
 */
import { useEffect } from 'react';
import { juninController } from '@/controllers/JuninController';
import { ModoSwitch } from './ModoSwitch';
import { MapaJunin } from './MapaJunin';
import { PanelJunin } from './PanelJunin';

export function JuninView() {
  useEffect(() => {
    void juninController.iniciar();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="z-toolbar flex h-toolbar items-center gap-4 border-b border-ui-border bg-ui-panel px-4">
        <h1 className="text-sm font-semibold tracking-tight">
          Lambda <span className="text-ui-ink-muted">Simulator · Junín</span>
        </h1>
        <ModoSwitch />
        <span className="ml-auto hidden text-2xs text-ui-ink-muted md:block">
          Mapa: satélite HD para dibujar + NASA GIBS en vivo · Cálculos: datos locales validados (ERA5-Land +
          PISCO, SoilGrids, DRA, FAO-56, AquaCrop)
        </span>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          <MapaJunin />
        </main>
        <aside
          aria-label="Simulador de Junín"
          className="w-[26rem] shrink-0 overflow-y-auto border-l border-ui-border bg-ui-panel"
        >
          <PanelJunin />
        </aside>
      </div>
    </div>
  );
}
