/**
 * Fase 6 · Registro de consultas a las fuentes de datos (cuándo, a qué, cuánto tardó y cómo
 * terminó). Lo llenan los lectores de datos y lo muestra «Origen y frescura».
 */
import { create } from 'zustand';

export type EstadoConsulta = 'ok' | 'error' | 'respaldo' | 'omitido';

export interface Consulta {
  /** id de la fuente (src/data/fuentes.ts) */
  fuente: string;
  /** Archivo, URL o descripción corta de lo pedido */
  recurso: string;
  /** ISO 8601 */
  cuando: string;
  ms: number | null;
  estado: EstadoConsulta;
  mensaje?: string;
}

const MAX = 200;

interface RegistroState {
  consultas: Consulta[];
}

export const useRegistro = create<RegistroState>()(() => ({ consultas: [] }));

export function registrarConsulta(c: Omit<Consulta, 'cuando'> & { cuando?: string }): void {
  const entrada: Consulta = { ...c, cuando: c.cuando ?? new Date().toISOString() };
  useRegistro.setState((s) => ({ consultas: [entrada, ...s.consultas].slice(0, MAX) }));
}

/** La última consulta de cada fuente */
export function ultimaPorFuente(consultas: readonly Consulta[]): Map<string, Consulta> {
  const m = new Map<string, Consulta>();
  for (const c of consultas) if (!m.has(c.fuente)) m.set(c.fuente, c);
  return m;
}

/** Envuelve una promesa: mide el tiempo y deja la consulta en el registro */
export async function medir<T>(fuente: string, recurso: string, p: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    const r = await p();
    registrarConsulta({ fuente, recurso, ms: Math.round(performance.now() - t0), estado: 'ok' });
    return r;
  } catch (e) {
    registrarConsulta({
      fuente,
      recurso,
      ms: Math.round(performance.now() - t0),
      estado: 'error',
      mensaje: (e as Error).message,
    });
    throw e;
  }
}
