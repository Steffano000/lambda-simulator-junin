/**
 * Raíz de composición (inyección de dependencias): crea UNA vez las fábricas y
 * servicios del dominio con los datos de los repositorios. Ninguna otra capa
 * instancia servicios de dominio por su cuenta.
 */
import { ClimateRepository, CropRepository, SoilRepository } from '@/data';
import type { ClimaEscenarios } from '@/data/types';
import { ActionsService, CommandFactory } from '@/domain/actions';
import { ClimateScenarioFactory } from '@/domain/climate';
import { CropFactory } from '@/domain/crops';
import { SimulationClock } from '@/domain/simulation';

const climaFuente: ClimaEscenarios = Object.fromEntries(
  ClimateRepository.scenarioNames().map((n) => [n, [...ClimateRepository.byName(n)!]]),
);

const commands = new CommandFactory();
const crops = new CropFactory(CropRepository.all());

export const container = {
  crops,
  commands,
  scenarios: new ClimateScenarioFactory(climaFuente),
  actions: new ActionsService(commands),
  clock: new SimulationClock(crops),
  soilOf: SoilRepository.byClass,
} as const;

export type Container = typeof container;
