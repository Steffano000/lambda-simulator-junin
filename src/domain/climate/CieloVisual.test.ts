/** Estado del cielo del día: el dominio decide, la vista lo pinta (src/scene/sky). */
import { describe, expect, it } from 'vitest';
import { ETIQUETA_CIELO, UMBRALES_CIELO, cieloDe, type EstadoCieloVisual } from './CieloVisual';
import type { ClimaDelDia, EventoLluvia, Intensidad } from './WeatherGenerator';

const dia = (over: Partial<ClimaDelDia> = {}): ClimaDelDia => ({
  dia: 0,
  mes: 1,
  tmed: 9,
  tmin: 5,
  et0: 3,
  hr: 50,
  probabilidad: 0.2,
  cielo: 'despejado',
  nubes: false,
  lluvia: null,
  validaciones: [],
  ...over,
});

const lluvia = (intensidad: Intensidad): EventoLluvia => ({
  mm: 12,
  intensidad,
  intensidadMmH: 4,
  duracionH: 3,
  tipo: 'lluvia',
});

describe('cieloDe', () => {
  it('un día templado y sin nubes es despejado', () => {
    expect(cieloDe(dia())).toBe('despejado');
  });

  it('el calor solo aparece sin lluvia ni nubes', () => {
    const caluroso = { tmed: UMBRALES_CIELO.calorTmed };
    expect(cieloDe(dia({ ...caluroso, hr: 95 }))).toBe('niebla');
    expect(cieloDe(dia({ ...caluroso, hr: 70 }))).toBe('calor');
  });

  it('la helada manda sobre el resto: es radiación, así que ocurre con cielo raso', () => {
    const frio = dia({ tmin: UMBRALES_CIELO.heladaTmin, tmed: 9, hr: 95 });
    expect(cieloDe(frio)).toBe('helada');
  });

  it('la lluvia pesa más que la nubosidad y su intensidad separa el estado', () => {
    expect(cieloDe(dia({ nubes: true, hr: 95, lluvia: lluvia('debil') }))).toBe('lluvia');
    expect(cieloDe(dia({ lluvia: lluvia('moderada') }))).toBe('lluvia');
    expect(cieloDe(dia({ lluvia: lluvia('fuerte') }))).toBe('lluvia-fuerte');
    expect(cieloDe(dia({ lluvia: lluvia('muy-fuerte') }))).toBe('lluvia-fuerte');
  });

  it('hr alta sin lluvia es niebla, y con nubes es nublado', () => {
    expect(cieloDe(dia({ hr: UMBRALES_CIELO.nieblaHr }))).toBe('niebla');
    expect(cieloDe(dia({ hr: 70, nubes: true }))).toBe('nublado');
  });

  it('todos los estados tienen etiqueta', () => {
    const estados: EstadoCieloVisual[] = [
      'despejado',
      'calor',
      'nublado',
      'niebla',
      'lluvia',
      'lluvia-fuerte',
      'helada',
    ];
    expect(estados.every((e) => ETIQUETA_CIELO[e].length > 0)).toBe(true);
  });
});
