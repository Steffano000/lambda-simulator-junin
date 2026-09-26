import type { ReactNode } from 'react';
import { Toolbar } from '../components/Toolbar';
import { SimulationPanel } from '../panels/SimulationPanel';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <SimulationPanel />
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
