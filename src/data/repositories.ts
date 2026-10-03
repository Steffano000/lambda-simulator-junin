/**
 * Patrón Repository: único punto de lectura de data/*.json.
 * El dominio (motores, reglas) recibe estos datos inyectados; nunca importa JSON.
 */
import climaJson from '@data/clima_escenarios.json';
import cultivosJson from '@data/cultivos.json';
import metaJson from '@data/meta.json';
import siembraJson from '@data/siembra_cultivos.json';
import mezclasJson from '@data/terrenos_mezclas.json';
import terrenosJson from '@data/terrenos.json';
import type {
  ClimaEscenarios,
  ClimaMes,
  Cultivo,
  MezclaSuelos,
  Meta,
  SiembraCultivo,
  SiembraCultivos,
  Terreno,
} from './types';

const cultivos = cultivosJson.cultivos as Cultivo[];
const escenarios = climaJson.clima_escenarios as ClimaEscenarios;
const terrenos = terrenosJson.terrenos as Terreno[];
const mezclas = mezclasJson.mezclas as MezclaSuelos[];

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

export const SoilMixRepository = {
  all: (): readonly MezclaSuelos[] => mezclas,
  byId: (id: string): MezclaSuelos | undefined => mezclas.find((m) => m.id === id),
};

export const MetaRepository = {
  get: (): Meta => metaJson.meta as Meta,
};

/** Marco de plantación y altitudes (data/siembra_cultivos.json), por id de Junín o nombre del 3D */
const siembra = siembraJson as unknown as SiembraCultivos;
export const SiembraRepository = {
  all: (): SiembraCultivos => siembra,
  byId: (id: string): SiembraCultivo | undefined => siembra.cultivos[id],
  byNombre3D: (nombre: string): SiembraCultivo | undefined =>
    Object.values(siembra.cultivos).find((c) => c.nombre_3d === nombre),
};
