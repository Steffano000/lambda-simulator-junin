/** Paso 03 · Builder de configuración de grilla + registro de presets de tamaño. */
export interface GridConfig {
  rows: number;
  cols: number;
  seed: number;
  /** Lado de la celda en metros (siempre 1 m³, design.md §1) */
  cellSize: 1;
}

export const GRID_LIMITS = { min: 3, max: 100 } as const;

export const SIZE_PRESETS = {
  demo: { rows: 10, cols: 10 },
  parcela: { rows: 20, cols: 20 },
  microcuenca: { rows: 40, cols: 40 },
} as const;

export type SizePreset = keyof typeof SIZE_PRESETS;

const clamp = (v: number) => Math.min(GRID_LIMITS.max, Math.max(GRID_LIMITS.min, Math.round(v)));

export class GridConfigBuilder {
  private config: GridConfig = { ...SIZE_PRESETS.demo, seed: 1, cellSize: 1 };

  size(rows: number, cols: number): this {
    this.config = { ...this.config, rows: clamp(rows), cols: clamp(cols) };
    return this;
  }

  preset(name: SizePreset): this {
    return this.size(SIZE_PRESETS[name].rows, SIZE_PRESETS[name].cols);
  }

  seed(seed: number): this {
    this.config = { ...this.config, seed };
    return this;
  }

  build(): GridConfig {
    return { ...this.config };
  }
}
