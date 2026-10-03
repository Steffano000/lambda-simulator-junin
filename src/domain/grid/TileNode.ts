/** Paso 01 · Nodo lógico de la grilla. Única fuente de verdad; la malla es solo su proyección. */
export interface Coords {
  /** Columna (eje X) */
  x: number;
  /** Fila (eje Z) */
  z: number;
}

export interface SoilState {
  /** `clase` de data/terrenos.json */
  clase: string;
  ph: number;
  n: number;
  p: number;
  k: number;
  materiaOrganica: number;
}

/** Paso 02 · Máquina de estados de la celda: Baldío → Arado → Sembrado → Maduro → Cosechado. */
export type CellLifecycle = 'baldio' | 'arado' | 'sembrado' | 'maduro' | 'cosechado';

/** Orientación de los surcos: a lo largo de las columnas (X) o de las filas (Z). */
export type OrientacionSurco = 'x' | 'z';

export interface TileNode {
  id: string;
  coords: Coords;
  /** Altura del bloque (eje Y, en cubos de 1 m). 0 = planicie; funcional desde el paso 07. */
  elevacion: number;
  suelo: SoilState;
  /**
   * Humedad en % del agua útil: 0 = PMP, 100 = CC. Puede superar 100 (agua gravitacional)
   * hasta el nivel de saturación del suelo.
   */
  humedad: number;
  /** Agua libre sobre la celda (mm): en surcos o como charco */
  aguaSuperficie: number;
  /** Surcos del arado y su orientación; null si la celda no está surcada */
  surcos: OrientacionSurco | null;
  /** Días consecutivos encharcada (el daño a raíces crece mientras persiste) */
  diasEncharcado: number;
  /** `nombre` de data/cultivos.json o null */
  vegetacionId: string | null;
  estado: CellLifecycle;
  /** Días de desarrollo del cultivo (fraccionarios: el estrés hídrico lo ralentiza) */
  diasCultivo: number;
  /** Celda ocupada por un canal de riego */
  canal: boolean;
  /** Índice de salud del cultivo (CHI) 0–100; 100 sin cultivo */
  salud: number;
  /** Día simulado hasta el que el suelo descansa (barbecho); null si no descansa */
  descansoHasta: number | null;
  /**
   * Celda donde no se puede trabajar (parcela real de Junín): fuera del polígono dibujado
   * o con cobertura bloqueada (ciudad, agua, nieve). Ninguna acción ni siembra la acepta.
   */
  bloqueado?: { motivo: string; color: string } | null;
  /** Celda fuera del polígono dibujado: existe para completar la grilla, pero no se dibuja */
  oculto?: boolean;
  /**
   * Parcela real: qué tan fino es el dato frente a la celda (Fase 2). 'remuestreado' = la celda
   * hereda el valor de un píxel más grande. Sin parcela real queda indefinido.
   */
  fidelidad?: 'real' | 'remuestreado' | 'extrapolado' | null;
  /**
   * Parcela real: área de la celda en m² (chunk² × fracción dentro del polígono). Sin parcela
   * real la celda mide 1 m² (design.md §1). Insumos, agua y cosecha se multiplican por ella.
   */
  areaM2?: number;
  /** Parcela real: lado de la celda en metros (tamaño de chunk); 1 m si no */
  ladoM?: number;
  /**
   * Parcela real: rendimiento del motor de Junín (t/ha) para cada cultivo del 3D en esta celda
   * (escenario, campaña y cultivo anterior elegidos; × uso de suelo y pH del chunk).
   */
  rendJuninTHa?: Record<string, number> | null;
}

/** Área de la celda en m² (1 m² salvo en la parcela real) */
export const areaCelda = (t: Pick<TileNode, 'areaM2'>): number => t.areaM2 ?? 1;

export const tileId = (x: number, z: number): string => `${x}:${z}`;

/** Campos por defecto de una celda nueva (agua libre, surcos, encharcamiento y descanso). */
export const AGUA_INICIAL = {
  aguaSuperficie: 0,
  surcos: null,
  diasEncharcado: 0,
  descansoHasta: null,
} as const;
