/**
 * Paso 05 · Factory de escenarios climáticos.
 * - Crea los escenarios reales desde la fuente inyectada (ClimateRepository).
 * - Valida y adapta escenarios personalizados al mismo tipo (Adapter).
 * - Cachea instancias: un escenario = un objeto (Registry).
 */
import type { ClimaEscenarios, ClimaMes } from '@/data/types';
import { ClimateScenario } from './ClimateScenario';

const CAMPOS = ['et0', 'lluvia', 'tmed', 'tmin'] as const;

export class ClimateScenarioFactory {
  private readonly cache = new Map<string, ClimateScenario>();

  constructor(private readonly fuente: ClimaEscenarios) {}

  nombres(): string[] {
    return [
      ...Object.keys(this.fuente),
      ...[...this.cache.values()].filter((e) => e.personalizado).map((e) => e.nombre),
    ];
  }

  create(nombre: string): ClimateScenario {
    const cached = this.cache.get(nombre);
    if (cached) return cached;

    const meses = this.fuente[nombre];
    if (!meses) throw new Error(`Escenario climático desconocido: "${nombre}".`);
    const escenario = new ClimateScenario(nombre, meses);
    this.cache.set(nombre, escenario);
    return escenario;
  }

  all(): ClimateScenario[] {
    return this.nombres().map((n) => this.create(n));
  }

  /** Escenario personalizado en formato clima_escenarios (12 meses). Lanza error si es inválido. */
  custom(nombre: string, meses: ClimaMes[]): ClimateScenario {
    const errores = ClimateScenarioFactory.validar(meses);
    if (errores.length) throw new Error(errores.join(' '));
    const escenario = new ClimateScenario(nombre, meses, true);
    this.cache.set(nombre, escenario);
    return escenario;
  }

  static validar(meses: ClimaMes[]): string[] {
    const errores: string[] = [];
    const presentes = new Set(meses.map((m) => m.mes));
    for (let mes = 1; mes <= 12; mes++) {
      if (!presentes.has(mes)) errores.push(`Falta el mes ${mes}.`);
    }
    for (const m of meses) {
      for (const campo of CAMPOS) {
        if (typeof m[campo] !== 'number' || Number.isNaN(m[campo])) {
          errores.push(`Mes ${m.mes}: "${campo}" no es numérico.`);
        }
      }
      if (m.lluvia < 0 || m.et0 < 0) errores.push(`Mes ${m.mes}: lluvia y ET0 no pueden ser negativas.`);
      if (m.tmin > m.tmed) errores.push(`Mes ${m.mes}: tmin no puede superar tmed.`);
    }
    return errores;
  }
}
