import { SceneCanvas } from '@/scene';
import { ClimateModal } from '@/ui/climate/ClimateModal';
import { HarvestReportModal } from '@/ui/harvest/HarvestReportModal';
import { ActionFeedback } from '@/ui/components/ActionFeedback';
import { Legend } from '@/ui/components/Legend';
import { SelectionPanels } from '@/ui/selection/SelectionPanels';
import { TimeBar } from '@/ui/components/TimeBar';
import { AppShell } from '@/ui/layout/AppShell';
import { JuninView } from '@/ui/junin/JuninView';
import { useJuninStore } from '@/store/juninStore';

export function App() {
  const modo = useJuninStore((s) => s.modo);
  if (modo === 'junin') return <JuninView />;
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
