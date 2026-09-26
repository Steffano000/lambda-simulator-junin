import { SceneCanvas } from '@/scene/SceneCanvas';
import { Inspector } from '@/ui/components/Inspector';
import { Legend } from '@/ui/components/Legend';
import { AppShell } from '@/ui/layout/AppShell';

export function App() {
  return (
    <AppShell>
      <SceneCanvas />
      <Legend />
      <Inspector />
    </AppShell>
  );
}
