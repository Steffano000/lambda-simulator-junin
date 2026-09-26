/**
 * Estados de hidratación del terreno y su lectura para un cultivo.
 * El estado se calcula del agua actual del perfil y de la superficie, que ya integra
 * precipitación, riego, absorción, retención, drenaje y evaporación (WaterBalance).
 */
export type EstadoHidrico = 'seco' | 'baja' | 'adecuada' | 'alta' | 'saturado' | 'encharcado';

export const ESTADOS_HIDRICOS: readonly EstadoHidrico[] = [
  'seco',
  'baja',
  'adecuada',
  'alta',
  'saturado',
  'encharcado',
];

export const ETIQUETA_HIDRICA: Record<EstadoHidrico, string> = {
  seco: 'Seco',
  baja: 'Baja hidratación',
  adecuada: 'Hidratación adecuada',
  alta: 'Alta hidratación',
  saturado: 'Saturado',
  encharcado: 'Encharcado',
};

/** Cortes en % del agua útil (0 = PMP, 100 = CC). */
export const CORTES_HIDRICOS = { seco: 20, baja: 50, alta: 90, capacidad: 100 } as const;

/** Agua libre mínima (mm) para considerar que hay lámina en superficie. */
const LAMINA_MIN_MM = 0.5;

/**
 * Encharcado = hay agua en superficie y el suelo ya no puede absorberla (saturado).
 * Con surcos llenos pero suelo no saturado, el agua todavía se está infiltrando.
 */
export function estadoHidrico(humedad: number, aguaSuperficie: number, saturacionPct: number): EstadoHidrico {
  if (aguaSuperficie > LAMINA_MIN_MM && humedad >= saturacionPct - 2) return 'encharcado';
  if (humedad > CORTES_HIDRICOS.capacidad) return 'saturado';
  if (humedad > CORTES_HIDRICOS.alta) return 'alta';
  if (humedad >= CORTES_HIDRICOS.baja) return 'adecuada';
  if (humedad >= CORTES_HIDRICOS.seco) return 'baja';
  return 'seco';
}

export type EfectoHidrico = 'deficit' | 'adecuado' | 'exceso' | 'encharcado';

/** ¿La hidratación beneficia o perjudica a un cultivo con este umbral de estrés? */
export function efectoEnCultivo(estado: EstadoHidrico, humedad: number, umbral: number): EfectoHidrico {
  if (estado === 'encharcado') return 'encharcado';
  if (estado === 'saturado') return 'exceso';
  return humedad < umbral ? 'deficit' : 'adecuado';
}
