/** Instancias únicas de los controladores, compartidas por todas las vistas. */
import { container } from '@/app/container';
import { useSimStore } from '@/store/useSimStore';
import { ClimateController } from './ClimateController';
import { HarvestController } from './HarvestController';
import { PlantingController } from './PlantingController';
import { SelectionController } from './SelectionController';
import { TerrainController } from './TerrainController';
import { TimeController } from './TimeController';
import { TreatmentController } from './TreatmentController';

export const controllers = {
  terrain: new TerrainController(useSimStore, container),
  selection: new SelectionController(useSimStore, container),
  treatment: new TreatmentController(useSimStore, container),
  planting: new PlantingController(useSimStore, container),
  climate: new ClimateController(useSimStore, container),
  harvest: new HarvestController(useSimStore, container),
  time: new TimeController(useSimStore, container),
} as const;

export type Controllers = typeof controllers;
