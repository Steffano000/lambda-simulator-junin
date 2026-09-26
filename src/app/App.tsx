import { SceneCanvas } from '@/scene/SceneCanvas';
import { ActionFeedback } from '@/ui/components/ActionFeedback';
import { Legend } from '@/ui/components/Legend';
import { SelectionCard } from '@/ui/components/SelectionCard';
import { TimeBar } from '@/ui/components/TimeBar';
import { AppShell } from '@/ui/layout/AppShell';

export function App() {
  return (
    <AppShell>
      <SceneCanvas />
      <ActionFeedback />
      <SelectionCard />
      <Legend />
      <TimeBar />
    </AppShell>
  );
}
