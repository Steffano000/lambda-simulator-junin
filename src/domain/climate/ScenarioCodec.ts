/**
 * Sandbox climático · Adapter de importación/exportación en el formato de
 * data/clima_escenarios.json. Acepta:
 *   - { "clima_escenarios": { "<nombre>": [12 meses] } }
 *   - { "<nombre>": [12 meses] }
 *   - [12 meses]  (se usa el nombre sugerido)
 * El parser es propio y tolerante: informa errores, nunca lanza al usuario un crash.
 */
import type { ClimaMes } from '@/data/types';
import type { ClimateScenario } from './ClimateScenario';
import { ClimateScenarioFactory } from './ClimateScenarioFactory';

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface EscenarioImportado {
  nombre: string;
  meses: ClimaMes[];
  errores: string[];
}

function aMes(raw: unknown, i: number): ClimaMes {
  const o = (raw ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : Number(o[k]));
  const mes = Number.isInteger(o.mes) ? (o.mes as number) : i + 1;
  return {
    mes,
    nombre: typeof o.nombre === 'string' ? o.nombre : (NOMBRES_MES[mes - 1] ?? `M${mes}`),
    et0: num('et0'),
    lluvia: num('lluvia'),
    tmed: num('tmed'),
    tmin: num('tmin'),
  };
}

export class ScenarioCodec {
  static parse(texto: string, nombreSugerido = 'Importado'): EscenarioImportado[] {
    let data: unknown;
    try {
      data = JSON.parse(texto);
    } catch (e) {
      return [{ nombre: nombreSugerido, meses: [], errores: [`JSON inválido: ${(e as Error).message}`] }];
    }

    const raiz =
      data && typeof data === 'object' && 'clima_escenarios' in data
        ? (data as { clima_escenarios: unknown }).clima_escenarios
        : data;

    const entradas: [string, unknown][] = Array.isArray(raiz)
      ? [[nombreSugerido, raiz]]
      : raiz && typeof raiz === 'object'
        ? Object.entries(raiz)
        : [];

    if (entradas.length === 0) {
      return [{ nombre: nombreSugerido, meses: [], errores: ['No se encontraron escenarios en el JSON.'] }];
    }

    return entradas.map(([nombre, lista]) => {
      if (!Array.isArray(lista))
        return { nombre, meses: [], errores: ['Se esperaba una lista de 12 meses.'] };
      const meses = lista.map(aMes);
      return { nombre, meses, errores: ClimateScenarioFactory.validar(meses) };
    });
  }

  static stringify(escenarios: readonly ClimateScenario[]): string {
    const clima_escenarios = Object.fromEntries(escenarios.map((e) => [e.nombre, e.ordenados]));
    return JSON.stringify({ clima_escenarios }, null, 2);
  }
}
