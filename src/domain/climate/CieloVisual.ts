/**
 * Estado del cielo para la vista: traduce el clima del día (WeatherGenerator) a los
 * estados visuales que representan el fondo de la escena.
 *
 * El color de cada estado vive en los tokens (`cielo` de src/theme/tokens.ts) y la
 * etiqueta se muestra en el panel de ambiente: el color nunca es el único canal
 * (design.md §2). Las claves coinciden con las de `tokens.cielo`.
 */
import type { ClimaDelDia } from './WeatherGenerator';

export type EstadoCieloVisual =
  'despejado' | 'calor' | 'nublado' | 'niebla' | 'lluvia' | 'lluvia-fuerte' | 'helada';

export const ETIQUETA_CIELO: Record<EstadoCieloVisual, string> = {
  despejado: 'Despejado',
  calor: 'Calor',
  nublado: 'Nublado',
  niebla: 'Niebla',
  lluvia: 'Lluvia',
  'lluvia-fuerte': 'Lluvia fuerte',
  helada: 'Helada',
};

/**
 * Umbrales pensados para el altiplano de los escenarios (tmed 7–12 °C, tmin 2–9 °C):
 * "calor" es un día templado de sierra, no un día de costa.
 */
export const UMBRALES_CIELO = {
  /** tmed a partir del cual el día se ve caluroso. */
  calorTmed: 11,
  /** tmin por debajo del cual la noche es helada. */
  heladaTmin: 3,
  /** HR sin lluvia: día húmedo y brumoso. */
  nieblaHr: 80,
} as const;

/**
 * Estado visual del día, por orden de peso: primero lo que cambia el fondo de forma
 * inequívoca (hielo, agua), después la nubosidad y por último la temperatura.
 */
export function cieloDe(clima: ClimaDelDia): EstadoCieloVisual {
  const { tmed, tmin, hr, nubes, lluvia } = clima;
  if (tmin <= UMBRALES_CIELO.heladaTmin) return 'helada';
  if (lluvia) {
    return lluvia.intensidad === 'fuerte' || lluvia.intensidad === 'muy-fuerte' ? 'lluvia-fuerte' : 'lluvia';
  }
  if (hr >= UMBRALES_CIELO.nieblaHr) return 'niebla';
  if (nubes) return 'nublado';
  if (tmed >= UMBRALES_CIELO.calorTmed) return 'calor';
  return 'despejado';
}
