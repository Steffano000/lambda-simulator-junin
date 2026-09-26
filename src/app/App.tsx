import { SceneCanvas } from '@/scene/SceneCanvas';
import { ActionFeedback } from '@/ui/components/ActionFeedback';
import { Inspector } from '@/ui/components/Inspector';
import { Legend } from '@/ui/components/Legend';
import { AppShell } from '@/ui/layout/AppShell';

export function App() {
  return (
    <AppShell>
      <SceneCanvas />
      <ActionFeedback />
      <Legend />
      <Inspector />
    </AppShell>
  );
}
