/**
 * Puentes entre los datos de Junín y el formato que ya usa la app (data/*.json).
 * Permiten que los escenarios SARIMAX entren al ClimateScenarioFactory sin tocar el dominio.
 */
import type { ClimaEscenarios, ClimaMes } from '@/data/types';
import type { EscenarioId, MesEscenario, SimuladorEscenarios } from '@/data/junin/types';

const NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * 12 meses de un escenario (desde `desde`, por defecto el primero del pronóstico)
 * en el formato ClimaMes de data/clima_escenarios.json (mes calendario 1-12).
 */
export function aClimaMes(meses: readonly MesEscenario[], desde = 0): ClimaMes[] {
  return meses
    .slice(desde, desde + 12)
    .map((m) => {
      const mes = Number(m.mes.slice(5, 7));
      return {
        mes,
        nombre: NOMBRES[mes - 1],
        et0: r1(m.et0_mm),
        lluvia: r1(m.lluvia_mm),
        tmed: r1(m.tmed_c),
        tmin: r1(m.tmin_c),
      };
    })
    .sort((a, b) => a.mes - b.mes);
}

/** Nombre legible de un escenario de Junín para la galería de clima */
export function nombreEscenario(
  sim: SimuladorEscenarios,
  punto: string,
  esc: EscenarioId,
  campana = 0,
): string {
  const meses = sim.puntos[punto].escenarios[esc].meses;
  const ini = meses[campana * 12]?.mes ?? '';
  const fin = meses[campana * 12 + 11]?.mes ?? '';
  return `Junín · ${punto} · ${sim.meta.escenarios[esc]} (${ini} a ${fin})`;
}

/** Los 5 escenarios de un punto como ClimaEscenarios (para ClimateScenarioFactory) */
export function escenariosComoClima(sim: SimuladorEscenarios, punto: string, campana = 0): ClimaEscenarios {
  const p = sim.puntos[punto];
  const out: ClimaEscenarios = {};
  for (const esc of Object.keys(p.escenarios) as EscenarioId[]) {
    out[nombreEscenario(sim, punto, esc, campana)] = aClimaMes(p.escenarios[esc].meses, campana * 12);
  }
  return out;
}
