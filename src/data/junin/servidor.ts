/**
 * Fase 2 (opcional): servidor propio (server/main.py) que lee los TIF a 30 m.
 * Se activa definiendo VITE_API_URL (p. ej. http://127.0.0.1:8000). Si no existe o no
 * responde, la app sigue con los datos locales (Fase 1).
 */
import type { Anillo, GrillaChunks } from '@/domain/junin/parcela';

export const API_URL: string | undefined = import.meta.env.VITE_API_URL || undefined;

export async function servidorDisponible(): Promise<boolean> {
  if (!API_URL) return false;
  try {
    const r = await fetch(`${API_URL}/salud`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

/** POST /parcela: chunks de 30 m con relieve, suelo, cobertura y NDVI leídos de los TIF */
export async function chunksDelServidor(anillo: Anillo, celda_m?: number): Promise<GrillaChunks> {
  const q = celda_m ? `?celda_m=${celda_m}` : '';
  const r = await fetch(`${API_URL}/parcela${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'Polygon', coordinates: [[...anillo, anillo[0]]] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
  return (await r.json()) as GrillaChunks;
}
