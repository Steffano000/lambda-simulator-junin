/**
 * Patrón Repository: único punto de lectura de data/*.json.
 * El dominio (motores, reglas) recibe estos datos inyectados; nunca importa JSON.
 */
import climaJson from '@data/clima_escenarios.json';
import cultivosJson from '@data/cultivos.json';
import metaJson from '@data/meta.json';
import terrenosJson from '@data/terrenos.json';
import type { ClimaEscenarios, ClimaMes, Cultivo, Meta, Terreno } from './types';

const cultivos = cultivosJson.cultivos as Cultivo[];
const escenarios = climaJson.clima_escenarios as ClimaEscenarios;
const terrenos = terrenosJson.terrenos as Terreno[];

export const CropRepository = {
  all: (): readonly Cultivo[] => cultivos,
  byName: (nombre: string): Cultivo | undefined => cultivos.find((c) => c.nombre === nombre),
};

export const ClimateRepository = {
  scenarioNames: (): string[] => Object.keys(escenarios),
  byName: (nombre: string): readonly ClimaMes[] | undefined => escenarios[nombre],
};

export const SoilRepository = {
  all: (): readonly Terreno[] => terrenos,
  byClass: (clase: string): Terreno | undefined => terrenos.find((t) => t.clase === clase),
};

export const MetaRepository = {
  get: (): Meta => metaJson.meta as Meta,
};
