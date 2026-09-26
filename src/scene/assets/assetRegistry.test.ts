/** El catálogo cubre los cultivos de data/cultivos.json y resuelve por etapa. */
import { describe, expect, it } from 'vitest';
import { cropAssetAt, cropAssets, cropsSinModelo, terrainAssets } from './assetRegistry';

describe('assetRegistry', () => {
  it('todo cultivo del catálogo de datos tiene al menos un modelo', () => {
    expect(cropsSinModelo()).toEqual([]);
  });

  it('resuelve la ruta de una etapa y tolera las que no existen', () => {
    expect(cropAssetAt('Papa', 0)).toBe(cropAssets.Papa[0]);
    expect(cropAssetAt('Papa', 9)).toBeNull();
    expect(cropAssetAt('Cultivo inventado', 0)).toBeNull();
  });

  it('declara los elementos de terreno con modelo', () => {
    expect(Object.keys(terrainAssets).sort()).toEqual(['canal', 'roca']);
  });
});
