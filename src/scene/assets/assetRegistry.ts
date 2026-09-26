/**
 * Paso 01 · Registro estático de assets 3D (EP-01.2). Los .glb viven en public/models/.
 *
 * Catálogo por tipo de modelo, para que cada modelo de la escena declare solo las rutas
 * que necesita y se puedan resolver sin condicionales dispersos.
 *   - Cultivos: clave = `nombre` de data/cultivos.json; una ruta por etapa fenológica.
 *   - Terreno: un .glb por elemento (roca, canal).
 */
import { CropRepository } from '@/data';

/** Rutas de un cultivo, indexadas por etapa (0 = la primera del catálogo). */
export type RutasEtapa = readonly string[];

export type CatalogoCultivos = Readonly<Record<string, RutasEtapa>>;

/** Elementos de terreno con modelo propio. */
export type ElementoTerreno = 'roca' | 'canal';

export type CatalogoTerreno = Readonly<Record<ElementoTerreno, string>>;

export const cropAssets: CatalogoCultivos = {
  Papa: ['/models/crops/papa_stage_1.glb', '/models/crops/papa_stage_2.glb'],
  'Maíz amiláceo': ['/models/crops/maiz_stage_1.glb', '/models/crops/maiz_stage_2.glb'],
  Quinua: ['/models/crops/quinua_stage_1.glb', '/models/crops/quinua_stage_2.glb'],
  'Haba (grano seco)': ['/models/crops/haba_stage_1.glb', '/models/crops/haba_stage_2.glb'],
  'Avena forrajera': ['/models/crops/avena_stage_1.glb', '/models/crops/avena_stage_2.glb'],
};

export const terrainAssets: CatalogoTerreno = {
  roca: '/models/terrain/roca.glb',
  canal: '/models/terrain/canal.glb',
};

/** Ruta del modelo de `cultivo` en la etapa `etapa`; null si no hay modelo. */
export function cropAssetAt(cultivo: string, etapa: number): string | null {
  return cropAssets[cultivo]?.[etapa] ?? null;
}

/** Cultivos del catálogo de datos que aún no tienen .glb asignado. */
export function cropsSinModelo(
  nombres: readonly string[] = CropRepository.all().map((c) => c.nombre),
): string[] {
  return nombres.filter((nombre) => !(nombre in cropAssets));
}
