import { describe, expect, it } from 'vitest';
import { CropRepository } from '@/data';
import type { EtapaVisual } from '@/domain/crops';
import { stageColor } from '@/theme/ramps';
import { planta, surface } from '@/theme/tokens';
import { crecimiento, modeloPlanta, tieneModeloPropio, type EstadoPlanta } from './cropModels';

const estado = (etapa: EtapaVisual, progreso: number, over: Partial<EstadoPlanta> = {}): EstadoPlanta => ({
  etapa,
  progreso,
  salud: 100,
  muerta: false,
  ...over,
});

const alto = (cultivo: string, e: EstadoPlanta) =>
  Math.max(
    ...modeloPlanta(cultivo, e).map((p) => p.pos[1] + (p.forma === 'esfera' ? p.esc[1] / 2 : p.esc[1])),
  );

const colores = (cultivo: string, e: EstadoPlanta) => new Set(modeloPlanta(cultivo, e).map((p) => p.color));

describe('cropModels', () => {
  it('todos los cultivos de data/cultivos.json tienen diseño propio', () => {
    for (const c of CropRepository.all()) expect(tieneModeloPropio(c.nombre)).toBe(true);
  });

  it('cada especie tiene una silueta distinta (el maíz es el más alto, la papa la más baja)', () => {
    const adulta = estado('final', 0.85);
    const altos = CropRepository.all().map((c) => [c.nombre, alto(c.nombre, adulta)] as const);
    const orden = [...altos].sort((a, b) => a[1] - b[1]).map(([n]) => n);
    expect(orden[0]).toBe('Papa');
    expect(orden.at(-1)).toBe('Maíz amiláceo');
  });

  it('la planta crece con el progreso del ciclo', () => {
    expect(crecimiento(0)).toBeLessThan(crecimiento(0.4));
    expect(crecimiento(0.4)).toBeLessThan(crecimiento(0.8));
    for (const c of CropRepository.all()) {
      expect(alto(c.nombre, estado('germinacion', 0.1))).toBeLessThan(alto(c.nombre, estado('media', 0.6)));
    }
  });

  it('la papa florece en la etapa media y muestra tubérculos al final', () => {
    const p = planta.Papa;
    expect(colores('Papa', estado('desarrollo', 0.35)).has(p.flor)).toBe(false);
    expect(colores('Papa', estado('media', 0.6)).has(p.flor)).toBe(true);
    expect(colores('Papa', estado('final', 0.85)).has(p.fruto)).toBe(true);
  });

  it('el anillo de la base usa el color de la etapa (leyenda)', () => {
    for (const etapa of ['siembra', 'media', 'cosecha'] as const) {
      expect(modeloPlanta('Quinua', estado(etapa, 0.5))[0].color).toBe(stageColor(etapa));
    }
  });

  it('el estrés amarillea el follaje; la planta muerta se achata en gris', () => {
    const sana = colores('Haba (grano seco)', estado('desarrollo', 0.35));
    const estresada = colores('Haba (grano seco)', estado('desarrollo', 0.35, { salud: 20 }));
    expect(sana.has(planta['Haba (grano seco)'].hoja)).toBe(true);
    expect(estresada.has(planta['Haba (grano seco)'].hoja)).toBe(false);

    const muerta = modeloPlanta('Papa', estado('media', 0.6, { muerta: true }));
    expect(muerta).toHaveLength(1);
    expect(muerta[0].color).toBe(surface.roca);
  });

  it('un cultivo sin diseño usa el modelo genérico sin fallar', () => {
    expect(modeloPlanta('Tomate', estado('media', 0.6)).length).toBeGreaterThan(1);
  });
});
