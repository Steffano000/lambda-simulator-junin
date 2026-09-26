/**
 * Hidrología de la celda: variables hídricas del suelo, balance de agua (lluvia y riego
 * con el mismo sistema) y estados de hidratación.
 */
export {
  ALMACEN_SUPERFICIE,
  FACTOR_INFILTRACION_ARADO,
  PROFUNDIDAD_SUELO_M,
  SoilHydraulics,
  type PropiedadesHidricas,
} from './SoilHydraulics';
export {
  WaterBalance,
  ks,
  type CultivoAgua,
  type EntradaAgua,
  type EstadoAgua,
  type PasoDiario,
  type Suelo,
} from './WaterBalance';
export {
  CORTES_HIDRICOS,
  ESTADOS_HIDRICOS,
  ETIQUETA_HIDRICA,
  efectoEnCultivo,
  estadoHidrico,
  type EfectoHidrico,
  type EstadoHidrico,
} from './HydrationState';
export { aplicarAgua, sueloDeCelda, tieneSurcos } from './cellWater';
