/**
 * State → Visual de las marcas sobre la cara superior: qué geometría, a qué escala y con
 * qué color se dibujan las celdas seleccionadas y las que incumplen requisitos.
 */
import type { MaterialCategory } from '@/scene/render';

/** Tipos de marca que conviven sobre la grilla. */
export type TipoMarca = 'seleccion' | 'resaltada';

/** Categoría de material de cada marca (un material compartido por tipo). */
export const MATERIAL_POR_MARCA: Record<TipoMarca, MaterialCategory> = {
  seleccion: 'seleccion',
  resaltada: 'resaltada',
};

/**
 * Escala del marco. La de "resaltada" es menor para convivir con la de selección
 * sin taparla (el mismo anillo, dos tamaños).
 */
export const ESCALA_MARCA: Record<TipoMarca, number> = {
  seleccion: 1.04,
  resaltada: 0.86,
};

/** Separación sobre la cara superior: evita el z-fighting con el bloque. */
export const ELEVACION_MARCA = 0.01;

/** El marco es un anillo de 4 lados girado 45°: se lee como cuadro sin tapar la celda. */
export const MARCO = {
  interior: 0.36,
  exterior: 0.48,
  lados: 4,
} as const;
