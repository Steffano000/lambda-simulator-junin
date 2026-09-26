/**
 * Paso 04 · Factory + Registry de cultivos: una instancia `Crop` por nombre,
 * creada desde la fuente inyectada (CropRepository). Sin condicionales por especie.
 */
import type { Cultivo } from '@/data/types';
import { Crop } from './Crop';

export class CropFactory {
  private readonly registry = new Map<string, Crop>();

  constructor(fuente: readonly Cultivo[]) {
    for (const c of fuente) this.registry.set(c.nombre, new Crop(c));
  }

  create(nombre: string): Crop {
    const crop = this.registry.get(nombre);
    if (!crop) throw new Error(`Cultivo desconocido: "${nombre}".`);
    return crop;
  }

  find(nombre: string | null): Crop | undefined {
    return nombre ? this.registry.get(nombre) : undefined;
  }

  all(): Crop[] {
    return [...this.registry.values()];
  }
}
