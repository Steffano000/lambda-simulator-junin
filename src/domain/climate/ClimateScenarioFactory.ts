/**
 * Paso 05 · Factory + Registry de escenarios climáticos.
 * - Crea los escenarios reales desde la fuente inyectada (ClimateRepository).
 * - Registra, reemplaza y elimina escenarios personalizados (sandbox), siempre validados.
 * - Un escenario = un objeto cacheado.
 */
import type { ClimaEscenarios, ClimaMes } from '@/data/types';
import { ClimateScenario } from './ClimateScenario';

const CAMPOS = ['et0', 'lluvia', 'tmed', 'tmin'] as const;

/** Rangos físicamente plausibles para la sierra (valores mensuales). */
export const LIMITES_CLIMA = {
  lluvia: { min: 0, max: 800 },
  et0: { min: 0, max: 300 },
  tmed: { min: -15, max: 35 },
  tmin: { min: -25, max: 30 },
} as const;

export class ClimateScenarioFactory {
  private readonly cache = new Map<string, ClimateScenario>();
  private readonly personalizados = new Map<string, ClimateScenario>();

  constructor(private readonly fuente: ClimaEscenarios) {}

  reales(): string[] {
    return Object.keys(this.fuente);
  }

  nombres(): string[] {
    return [...this.reales(), ...this.personalizados.keys()];
  }

  esReal(nombre: string): boolean {
    return nombre in this.fuente;
  }

  existe(nombre: string): boolean {
    return this.esReal(nombre) || this.personalizados.has(nombre);
  }

  create(nombre: string): ClimateScenario {
    const personalizado = this.personalizados.get(nombre);
    if (personalizado) return personalizado;

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

  /**
   * Registra (o reemplaza) un escenario personalizado en formato clima_escenarios (12 meses).
   * Lanza error si es inválido o si el nombre pertenece a un escenario real.
   */
  custom(nombre: string, meses: ClimaMes[], base: string | null = null): ClimateScenario {
    const limpio = nombre.trim();
    if (!limpio) throw new Error('El escenario necesita un nombre.');
    if (this.esReal(limpio)) throw new Error(`"${limpio}" es un escenario real: usa otro nombre.`);
    const errores = ClimateScenarioFactory.validar(meses);
    if (errores.length) throw new Error(errores.join(' '));
    const escenario = new ClimateScenario(limpio, meses, true, base);
    this.personalizados.set(limpio, escenario);
    return escenario;
  }

  remove(nombre: string): boolean {
    return this.personalizados.delete(nombre);
  }

  static validar(meses: ClimaMes[]): string[] {
    const errores: string[] = [];
    const presentes = new Set(meses.map((m) => m.mes));
    for (let mes = 1; mes <= 12; mes++) {
      if (!presentes.has(mes)) errores.push(`Falta el mes ${mes}.`);
    }
    if (meses.length > 12) errores.push('Hay meses repetidos.');
    for (const m of meses) {
      for (const campo of CAMPOS) {
        const v = m[campo];
        if (typeof v !== 'number' || Number.isNaN(v)) {
          errores.push(`Mes ${m.mes}: "${campo}" no es numérico.`);
          continue;
        }
        const { min, max } = LIMITES_CLIMA[campo];
        if (v < min || v > max) errores.push(`Mes ${m.mes}: ${campo} ${v} fuera de rango (${min} a ${max}).`);
      }
      if (m.tmin > m.tmed) errores.push(`Mes ${m.mes}: tmin no puede superar tmed.`);
    }
    return errores;
  }
}
