/**
 * Raíz de composición (inyección de dependencias): crea UNA vez las fábricas y
 * servicios del dominio con los datos de los repositorios. Ninguna otra capa
 * instancia servicios de dominio por su cuenta.
 */
import { ClimateRepository, CropRepository, SoilRepository } from '@/data';
import type { ClimaEscenarios } from '@/data/types';
import { ActionsService, CommandFactory, PlantingValidator } from '@/domain/actions';
import { ClimateScenarioFactory } from '@/domain/climate';
import { CropFactory } from '@/domain/crops';
import { PlantationService } from '@/domain/plantation';
import { SimulationClock } from '@/domain/simulation';
import { HealthModel } from '@/domain/stress';
import { TerrainFactory } from '@/domain/terrain';

const climaFuente: ClimaEscenarios = Object.fromEntries(
  ClimateRepository.scenarioNames().map((n) => [n, [...ClimateRepository.byName(n)!]]),
);

const commands = new CommandFactory();
const crops = new CropFactory(CropRepository.all());
const health = new HealthModel();
const actions = new ActionsService(commands);

export const container = {
  crops,
  commands,
  health,
  actions,
  terrains: new TerrainFactory(SoilRepository.all()),
  scenarios: new ClimateScenarioFactory(climaFuente),
  validator: new PlantingValidator(actions),
  plantations: new PlantationService(health),
  clock: new SimulationClock(crops, health),
  soilOf: SoilRepository.byClass,
} as const;

export type Container = typeof container;
