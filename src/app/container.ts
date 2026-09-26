/**
 * Raíz de composición (inyección de dependencias): crea UNA vez las fábricas y
 * servicios del dominio con los datos de los repositorios. Ninguna otra capa
 * instancia servicios de dominio por su cuenta.
 */
import { ClimateRepository, CropRepository, SoilMixRepository, SoilRepository } from '@/data';
import type { ClimaEscenarios } from '@/data/types';
import { ActionsService, CommandFactory, PlantingValidator } from '@/domain/actions';
import { ClimateScenarioFactory } from '@/domain/climate';
import { CropFactory } from '@/domain/crops';
import { CropCellInspector, PlantationService } from '@/domain/plantation';
import { SimulationClock } from '@/domain/simulation';
import { SoilHydraulics } from '@/domain/hydrology';
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
  terrains: new TerrainFactory(SoilRepository.all(), SoilMixRepository.all()),
  scenarios: new ClimateScenarioFactory(climaFuente),
  validator: new PlantingValidator(actions),
  plantations: new PlantationService(health),
  cropInspector: new CropCellInspector(health),
  clock: new SimulationClock(crops, health),
  soilOf: SoilRepository.byClass,
  /** Variables hídricas de una clase de suelo (absorción, retención, drenaje, saturación) */
  hidraulica: (clase: string) => {
    const terreno = SoilRepository.byClass(clase);
    return terreno ? SoilHydraulics.of(terreno) : undefined;
  },
} as const;

export type Container = typeof container;
