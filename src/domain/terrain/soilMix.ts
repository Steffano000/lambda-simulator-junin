/**
 * Mezcla de suelos: el reparto en porcentaje de las clases de data/terrenos.json que
 * define la parcela. Es la variable que se modifica al generar el terreno (docs/07).
 *
 * Los datos (`data/terrenos_mezclas.json`) traen pesos que no tienen que sumar 100; aquí
 * se normalizan para que la mezcla siempre represente el 100 % de la parcela. Inmutable:
 * `conPorcentaje` devuelve una mezcla nueva, así el store guarda solo datos planos.
 */
import type { MezclaSuelos } from '@/data/types';
import { texturaDe, type Textura } from './textura';

/** Los porcentajes de una mezcla siempre suman este total. */
export const TOTAL_PORCENTAJE = 100;

export interface ParteMezcla {
  clase: string;
  /** Porcentaje normalizado, 0–100. */
  porcentaje: number;
}

const redondear = (v: number) => Math.round(v * 10) / 10;

/**
 * Normaliza un mapa de pesos a porcentajes que suman 100. Un peso 0 se conserva como
 * 0 % (la clase no aparece). Si todos los pesos son 0, la mezcla queda vacía y es el
 * factory quien avisa de que no se puede generar la parcela.
 */
export function normalizarPorcentajes(pesos: Readonly<Record<string, number>>): Record<string, number> {
  const total = Object.values(pesos).reduce((a, b) => a + Math.max(b, 0), 0);
  if (total <= 0) return {};
  const salida: Record<string, number> = {};
  for (const [clase, peso] of Object.entries(pesos)) {
    const pct = (Math.max(peso, 0) / total) * TOTAL_PORCENTAJE;
    if (pct > 0) salida[clase] = redondear(pct);
  }
  return salida;
}

/**
 * Peso bruto que hay que darle a una clase para que represente `objetivo` % cuando el
 * resto de la mezcla suma `resto`. Invierte la normalización: w = objetivo·resto / (100 − objetivo).
 */
function pesoParaPorcentaje(objetivo: number, resto: number): number {
  if (resto <= 0) return TOTAL_PORCENTAJE;
  if (objetivo >= TOTAL_PORCENTAJE) return resto + TOTAL_PORCENTAJE;
  if (objetivo <= 0) return 0;
  return (objetivo * resto) / (TOTAL_PORCENTAJE - objetivo);
}

export class SoilMix {
  /** Porcentajes normalizados (0–100) por clase. */
  readonly porcentajes: Readonly<Record<string, number>>;

  constructor(readonly datos: Readonly<MezclaSuelos>) {
    this.porcentajes = normalizarPorcentajes(datos.porcentajes);
  }

  get id(): string {
    return this.datos.id;
  }

  get nombre(): string {
    return this.datos.nombre;
  }

  get descripcion(): string {
    return this.datos.descripcion;
  }

  /** Clases que participan, de mayor a menor porcentaje. */
  partes(): ParteMezcla[] {
    return Object.entries(this.porcentajes)
      .map(([clase, porcentaje]) => ({ clase, porcentaje }))
      .sort((a, b) => b.porcentaje - a.porcentaje || a.clase.localeCompare(b.clase));
  }

  /** Porcentaje de una clase; 0 si no participa. */
  porcentajeDe(clase: string): number {
    return this.porcentajes[clase] ?? 0;
  }

  /** Clase dominante: la de mayor porcentaje. Determina textura y pH de referencia. */
  get dominante(): string {
    return this.partes()[0]?.clase ?? '';
  }

  get porcentajeDominante(): number {
    return this.porcentajeDe(this.dominante);
  }

  /** Textura agronómica de la clase dominante. */
  get textura(): Textura {
    return texturaDe(this.dominante);
  }

  /**
   * Copia de la mezcla con `clase` en el porcentaje indicado (0–100). El resto de clases
   * conserva su peso, así que subir una baja todo lo demás proporcionalmente: el
   * resultado es exactamente el % pedido, no un redondeo.
   *
   * El último suelo presente no se puede bajar del 100 %: sin él la parcela no tendría
   * suelo y el terreno no se podría generar.
   */
  conPorcentaje(clase: string, porcentaje: number): SoilMix {
    const objetivo = Math.min(TOTAL_PORCENTAJE, Math.max(0, redondear(porcentaje)));
    const pesos = this.datos.porcentajes;
    const resto = Object.entries(pesos)
      .filter(([c]) => c !== clase)
      .reduce((a, [, peso]) => a + Math.max(peso, 0), 0);

    return new SoilMix({
      ...this.datos,
      porcentajes: { ...pesos, [clase]: redondear(pesoParaPorcentaje(objetivo, resto)) },
    });
  }

  /** Construye la mezcla a partir de sus datos planos (JSON o estado del store). */
  static de(datos: Readonly<MezclaSuelos>): SoilMix {
    return new SoilMix(datos);
  }
}
