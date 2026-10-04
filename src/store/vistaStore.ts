/**
 * Opciones de VISTA de la escena 3D (Fases 4 y 5): no cambian la simulación, solo cómo se dibuja.
 * Store aparte para que cambiar una opción no recalcule nada del dominio.
 */
import { create } from 'zustand';

export type ModoTerreno = 'bloques' | 'continuo';

export interface VistaState {
  /** Nubes visibles (si el clima del día las tiene) */
  nubes: boolean;
  /** Sombra de las nubes sobre el terreno (apagada por defecto: design.md §2, sin sombras) */
  sombraNubes: boolean;
  /** Bloques por celda o superficie continua recortada a la parcela */
  terreno: ModoTerreno;
  /** Pasadas de suavizado de la superficie continua (0 = el relieve tal cual) */
  suavizado: number;
  /** Exageración vertical del relieve (1 a 3) */
  exageracion: number;
}

export const useVistaStore = create<VistaState>()(() => ({
  nubes: true,
  sombraNubes: false,
  terreno: 'continuo',
  suavizado: 1,
  exageracion: 3,
}));

export const vista = {
  set: (p: Partial<VistaState>) => useVistaStore.setState(p),
};
