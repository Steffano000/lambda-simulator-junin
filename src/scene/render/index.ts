/**
 * Infraestructura de render compartida por todos los modelos 3D: magnitudes, materiales
 * y el machinery de instancing. No sabe nada de celdas, cultivos ni marcas.
 */
export { BLOQUE_GAP, TILE_SIZE } from './magnitudes';
export { InstanceBatch } from './instanceBatch';
export { InstanceField, type InstanceFieldProps, type InstancePointer } from './InstanceField';
export { getMaterial, type MaterialCategory } from './materialFactory';
