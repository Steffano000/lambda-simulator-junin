/**
 * Modelo del cultivo: diseño por especie (cropModels), geometría de las piezas y capas
 * del terreno (cultivo real y vista previa translúcida).
 */
export { ALTURA_CROPO_MUERTO, ALTURA_POR_ETAPA, cropColor, cropHeight } from './cropVisual';
export { FORMAS, GEOMETRIA, matrizPieza, yawDe } from './cropGeometry';
export {
  ESTADO_PREVIA,
  crecimiento,
  mezclar,
  modeloPlanta,
  tieneModeloPropio,
  type EstadoPlanta,
  type Forma,
  type Pieza,
} from './cropModels';
export { PlantField, type PlantFieldProps, type PlantaEnCelda } from './PlantField';
export { PlantsLayer, type PlantsLayerProps } from './PlantsLayer';
export { PreviewPlantsLayer } from './PreviewPlantsLayer';
