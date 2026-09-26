/**
 * Persistencia local de escenarios personalizados (conveniencia del navegador).
 * Adapter sobre localStorage: si no está disponible (modo privado, bloqueo), el
 * simulador sigue funcionando y los escenarios se pueden exportar a JSON.
 */
import type { ClimaMes } from './types';

export interface EscenarioGuardado {
  nombre: string;
  base: string | null;
  meses: ClimaMes[];
}

const CLAVE = 'lambda-simulator:escenarios-personalizados:v1';

export const CustomScenarioStorage = {
  load(): EscenarioGuardado[] {
    try {
      const raw = localStorage.getItem(CLAVE);
      const data = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(data) ? (data as EscenarioGuardado[]) : [];
    } catch {
      return [];
    }
  },

  save(escenarios: readonly EscenarioGuardado[]): void {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(escenarios));
    } catch {
      // Sin almacenamiento disponible: se conservan solo en memoria
    }
  },
};
