/**
 * Catálogo de insumos y precios (soles, S/) para el balance de la cosecha.
 *
 * SUPUESTOS DE SIMULACIÓN (no vienen de data/): dosis típicas por m² y precios de chacra
 * de referencia para el valle del Mantaro. Se ajustan aquí; nada más en el código los fija.
 */
import type { ToolId } from '../actions';

export type InsumoId =
  'abono-organico' | 'abono-quimico' | 'cal' | 'azufre' | 'semilla' | 'agua' | 'mano-de-obra';

export interface Insumo {
  id: InsumoId;
  nombre: string;
  unidad: 'kg' | 'L' | 'h';
  /** Precio por unidad (S/) */
  precio: number;
}

export const INSUMOS: Record<InsumoId, Insumo> = {
  'abono-organico': {
    id: 'abono-organico',
    nombre: 'Abono orgánico (compost/estiércol)',
    unidad: 'kg',
    precio: 0.3,
  },
  'abono-quimico': { id: 'abono-quimico', nombre: 'Fertilizante N-P-K', unidad: 'kg', precio: 3.5 },
  cal: { id: 'cal', nombre: 'Cal agrícola', unidad: 'kg', precio: 0.8 },
  azufre: { id: 'azufre', nombre: 'Azufre elemental', unidad: 'kg', precio: 4 },
  semilla: { id: 'semilla', nombre: 'Semilla', unidad: 'kg', precio: 0 },
  agua: { id: 'agua', nombre: 'Agua de riego', unidad: 'L', precio: 0.0001 },
  'mano-de-obra': { id: 'mano-de-obra', nombre: 'Mano de obra', unidad: 'h', precio: 7.5 },
};

export interface Consumo {
  insumo: InsumoId;
  /** Cantidad por celda de 1 m² y por aplicación */
  cantidad: number;
}

/**
 * Qué gasta cada acción en una celda de 1 m². La semilla depende del cultivo
 * (ver ECONOMIA_CULTIVO); el agua del riego se cuenta en litros (1 mm = 1 L/m²).
 */
export const CONSUMO_POR_ACCION: Record<ToolId, readonly Consumo[]> = {
  arar: [{ insumo: 'mano-de-obra', cantidad: 0.006 }],
  encalar: [
    { insumo: 'cal', cantidad: 0.3 },
    { insumo: 'mano-de-obra', cantidad: 0.002 },
  ],
  acidificar: [
    { insumo: 'azufre', cantidad: 0.1 },
    { insumo: 'mano-de-obra', cantidad: 0.002 },
  ],
  'abonar-organico': [
    { insumo: 'abono-organico', cantidad: 2 },
    { insumo: 'mano-de-obra', cantidad: 0.004 },
  ],
  'abonar-quimico': [
    { insumo: 'abono-quimico', cantidad: 0.05 },
    { insumo: 'mano-de-obra', cantidad: 0.002 },
  ],
  regar: [{ insumo: 'agua', cantidad: 20 }],
  inundar: [{ insumo: 'agua', cantidad: 50 }],
  drenar: [{ insumo: 'mano-de-obra', cantidad: 0.01 }],
  canal: [{ insumo: 'mano-de-obra', cantidad: 0.05 }],
  sembrar: [{ insumo: 'mano-de-obra', cantidad: 0.003 }],
  cosechar: [{ insumo: 'mano-de-obra', cantidad: 0.01 }],
  remover: [{ insumo: 'mano-de-obra', cantidad: 0.005 }],
  descansar: [],
};

/** Duración de cada riego (h): el tiempo de agua se cuenta por evento, no por celda. */
export const HORAS_RIEGO: Partial<Record<ToolId, number>> = { regar: 2, inundar: 3 };

export interface EconomiaCultivo {
  /** Semilla por m² (kg) */
  semillaKgM2: number;
  /** Precio de la semilla (S/ por kg) */
  precioSemilla: number;
  /** Precio de venta en chacra (S/ por kg) */
  precioVenta: number;
}

/** Clave = `nombre` de data/cultivos.json. */
export const ECONOMIA_CULTIVO: Record<string, EconomiaCultivo> = {
  Papa: { semillaKgM2: 0.2, precioSemilla: 2.5, precioVenta: 1.0 },
  'Maíz amiláceo': { semillaKgM2: 0.004, precioSemilla: 12, precioVenta: 3.0 },
  Quinua: { semillaKgM2: 0.001, precioSemilla: 15, precioVenta: 6.0 },
  'Haba (grano seco)': { semillaKgM2: 0.012, precioSemilla: 8, precioVenta: 4.0 },
  'Avena forrajera': { semillaKgM2: 0.01, precioSemilla: 5, precioVenta: 0.3 },
};

const ECONOMIA_GENERICA: EconomiaCultivo = { semillaKgM2: 0.01, precioSemilla: 5, precioVenta: 1 };

export const economiaDe = (cultivo: string): EconomiaCultivo =>
  ECONOMIA_CULTIVO[cultivo] ?? ECONOMIA_GENERICA;
