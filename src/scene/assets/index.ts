/**
 * Assets 3D: catálogo estático de rutas y carga con DRACO. Se separa del resto de la
 * escena para que los modelos (.glb) puedan entrar sin tocar capas ni componentes.
 */
export { fallbackPrimitive, loadAsset, preloadAssets } from './AssetLoader';
export {
  cropAssetAt,
  cropAssets,
  cropsSinModelo,
  terrainAssets,
  type CatalogoCultivos,
  type CatalogoTerreno,
  type ElementoTerreno,
  type RutasEtapa,
} from './assetRegistry';
