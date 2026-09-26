/** Paso 1 del flujo · Selección del terreno: vista previa, confirmación y reinicio. */
import type { TerrainOptions } from '@/domain/terrain';
import { OPCIONES_INICIALES } from '@/store/gridSlice';
import { BaseController } from './BaseController';

export class TerrainController extends BaseController {
  /** Actualiza la vista previa mientras se eligen las opciones (sin confirmar). */
  preview(cambios: Partial<TerrainOptions>): void {
    const opcionesTerreno = { ...this.state.opcionesTerreno, ...cambios };
    const profile = this.deps.terrains.createProfile(opcionesTerreno);
    this.set({
      opcionesTerreno,
      config: profile.config,
      tiles: this.deps.terrains.createTiles(profile),
      seleccion: [],
    });
  }

  setMesInicio(mes: number): void {
    this.set({ mesInicio: Math.min(12, Math.max(1, mes)) });
  }

  /** Confirma el terreno: punto de partida obligatorio del flujo. */
  confirm(): void {
    const terreno = this.deps.terrains.createProfile(this.state.opcionesTerreno);
    this.set({
      terreno,
      config: terreno.config,
      tiles: this.deps.terrains.createTiles(terreno),
      fase: 'tratamiento',
      seleccion: [],
      herramienta: null,
      dia: 0,
      plantaciones: [],
      cosechas: [],
      correccion: null,
      ultimoAvance: null,
    });
    this.notify('ok', `Terreno listo: ${terreno.descripcion}. Selecciona una acción y las celdas a tratar.`);
  }

  /** Vuelve a elegir terreno: descarta tratamientos y plantaciones. */
  reset(): void {
    this.set({ terreno: null, fase: 'terreno', cultivo: null, mensaje: null });
    this.preview(this.state.opcionesTerreno ?? OPCIONES_INICIALES);
    this.set({ dia: 0, plantaciones: [], cosechas: [], correccion: null, ultimoAvance: null });
  }
}
