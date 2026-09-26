/** El mapeo estado → visual de la celda es la base de las tres capas: se fija aquí. */
import { describe, expect, it } from 'vitest';
import { createGrid, GridConfigBuilder } from '@/domain/grid';
import { chiColor, humidityColor, phColor, soilColor } from '@/theme/ramps';
import { surface } from '@/theme/tokens';
import { ALTURA_BLOQUE, tileColor, tileHeight } from './tileVisual';

const config = new GridConfigBuilder().preset('demo').build();
const [tile] = createGrid(config, ['Arena', 'Franco', 'Arcilla']);

describe('tileColor', () => {
  it('el canal manda sobre cualquier overlay', () => {
    expect(tileColor({ ...tile, canal: true }, 'humedad')).toBe(surface.agua);
  });

  it('cada overlay delega en su rampa', () => {
    const conCultivo = { ...tile, vegetacionId: 'Papa' };
    expect(tileColor(tile, 'suelo')).toBe(soilColor(tile.suelo.clase));
    expect(tileColor(tile, 'humedad')).toBe(humidityColor(tile.humedad));
    expect(tileColor(tile, 'ph')).toBe(phColor(tile.suelo.ph));
    expect(tileColor(conCultivo, 'salud')).toBe(chiColor(tile.salud));
  });

  it('sin cultivo, el overlay de salud deja la celda en gris neutro', () => {
    expect(tileColor(tile, 'salud')).toBe(surface.vacio);
  });
});

describe('tileHeight', () => {
  it('baldío a altura completa, suelo trabajado con surcos', () => {
    expect(tileHeight({ ...tile, estado: 'baldio' })).toBe(ALTURA_BLOQUE.baldio);
    expect(tileHeight({ ...tile, estado: 'arado' })).toBe(ALTURA_BLOQUE.trabajado);
  });

  it('el canal se hunde por debajo del bloque trabajado', () => {
    expect(tileHeight({ ...tile, canal: true, estado: 'sembrado' })).toBe(ALTURA_BLOQUE.canal);
  });
});
