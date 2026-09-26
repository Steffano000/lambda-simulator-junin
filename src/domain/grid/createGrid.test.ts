import { describe, expect, it } from 'vitest';
import { createGrid } from './createGrid';
import { GridConfigBuilder, GRID_LIMITS } from './GridConfig';

const classes = ['Arena', 'Franco', 'Arcilla'];

describe('createGrid', () => {
  it('crea N×M celdas', () => {
    const config = new GridConfigBuilder().size(4, 6).build();
    expect(createGrid(config, classes)).toHaveLength(24);
  });

  it('es determinista: misma semilla → misma grilla', () => {
    const config = new GridConfigBuilder().preset('demo').seed(42).build();
    expect(createGrid(config, classes)).toEqual(createGrid(config, classes));
  });

  it('acota dimensiones a los límites del paso 03', () => {
    const config = new GridConfigBuilder().size(1, 500).build();
    expect(config.rows).toBe(GRID_LIMITS.min);
    expect(config.cols).toBe(GRID_LIMITS.max);
  });
});
