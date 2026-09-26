import type { ReactNode } from 'react';
import { Toolbar } from '../components/Toolbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <main className="relative min-h-0 flex-1">{children}</main>
    </div>
  );
}
