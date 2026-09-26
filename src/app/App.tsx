import { SceneCanvas } from '@/scene';
import { ClimateModal } from '@/ui/climate/ClimateModal';
import { HarvestReportModal } from '@/ui/harvest/HarvestReportModal';
import { ActionFeedback } from '@/ui/components/ActionFeedback';
import { Legend } from '@/ui/components/Legend';
import { SelectionPanels } from '@/ui/selection/SelectionPanels';
import { TimeBar } from '@/ui/components/TimeBar';
import { AppShell } from '@/ui/layout/AppShell';

export function App() {
  return (
    <>
      <AppShell>
        <SceneCanvas />
        <ActionFeedback />
        <SelectionPanels />
        <Legend />
        <TimeBar />
      </AppShell>
      <ClimateModal />
      <HarvestReportModal />
    </>
  );
}
