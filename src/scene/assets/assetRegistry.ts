/**
 * Paso 01 · Registro estático de assets 3D (EP-01.2). Los .glb viven en public/models/.
 * Clave = `nombre` de data/cultivos.json; una ruta por etapa fenológica.
 */
export const cropAssets: Record<string, string[]> = {
  Papa: ['/models/crops/papa_stage_1.glb', '/models/crops/papa_stage_2.glb'],
  'Maíz amiláceo': ['/models/crops/maiz_stage_1.glb', '/models/crops/maiz_stage_2.glb'],
  Quinua: ['/models/crops/quinua_stage_1.glb', '/models/crops/quinua_stage_2.glb'],
  'Haba (grano seco)': ['/models/crops/haba_stage_1.glb', '/models/crops/haba_stage_2.glb'],
  'Avena forrajera': ['/models/crops/avena_stage_1.glb', '/models/crops/avena_stage_2.glb'],
};

export const terrainAssets = {
  roca: '/models/terrain/roca.glb',
  canal: '/models/terrain/canal.glb',
} as const;
