import type { ReactNode } from 'react';

/** Bloque titulado del panel lateral. */
export function Section({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-b border-ui-border px-4 py-3 last:border-0">
      <h2 className="mb-2 text-2xs font-semibold tracking-wide text-ui-ink-muted uppercase">{titulo}</h2>
      {children}
    </section>
  );
}
