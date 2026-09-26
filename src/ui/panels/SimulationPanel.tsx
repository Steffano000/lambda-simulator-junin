/** Panel lateral de simulación: compone las vistas de escenario, cultivo, herramientas y tiempo. */
import { CropSelector } from './CropSelector';
import { HarvestLog } from './HarvestLog';
import { ScenarioSelector } from './ScenarioSelector';
import { TimeControls } from './TimeControls';
import { ToolPalette } from './ToolPalette';

export function SimulationPanel() {
  return (
    <aside
      aria-label="Panel de simulación"
      className="w-72 shrink-0 overflow-y-auto border-r border-ui-border bg-ui-panel"
    >
      <ScenarioSelector />
      <CropSelector />
      <ToolPalette />
      <TimeControls />
      <HarvestLog />
    </aside>
  );
}
