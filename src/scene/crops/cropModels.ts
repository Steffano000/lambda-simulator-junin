/**
 * Modelos low-poly de cada cultivo (design.md §2): funciones puras que, dada la etapa y el
 * progreso del ciclo, devuelven las piezas (forma + transformación + color) de la planta.
 *
 * Patrón: registro de estrategias por especie (Strategy + Registry). Agregar un cultivo =
 * una función más en MODELOS. Sin Three.js ni React: los usan la escena (instancing), la
 * vista previa de la fase de cultivos y los tests.
 *
 * Unidades en metros, sobre una celda de 1 m; y = 0 es la superficie donde se apoya.
 */
import type { EtapaVisual } from '@/domain/crops';
import { stageColor } from '@/theme/ramps';
import { planta, surface, type PaletaPlanta } from '@/theme/tokens';

export type Forma = 'caja' | 'cono' | 'cilindro' | 'esfera';
export type Vec3 = readonly [number, number, number];

export interface Pieza {
  forma: Forma;
  /** Base de la pieza (caja/cono/cilindro) o centro (esfera) */
  pos: Vec3;
  /** Rotación Euler XYZ (rad) */
  rot: Vec3;
  esc: Vec3;
  color: string;
}

export interface EstadoPlanta {
  etapa: EtapaVisual;
  /** 0 = recién sembrada, 1 = ciclo completo */
  progreso: number;
  /** CHI 0–100: el estrés amarillea el follaje */
  salud: number;
  muerta: boolean;
}

type Modelo = (p: Constructor) => void;

// ---------- Utilidades de color y forma

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mezcla lineal a → b (t 0–1). */
export function mezclar(a: string, b: string, t: number): string {
  const [ra, ga, ba] = hexToRgb(a);
  const [rb, gb, bb] = hexToRgb(b);
  const k = Math.min(1, Math.max(0, t));
  const c = [ra + (rb - ra) * k, ga + (gb - ga) * k, ba + (bb - ba) * k];
  return (
    '#' +
    c
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

const suave = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** Tamaño relativo según el progreso: crece rápido en desarrollo y se estabiliza al final. */
export const crecimiento = (progreso: number) => 0.12 + 0.88 * suave(progreso / 0.75);

/** Senescencia del follaje: 0 hasta la etapa final, 1 al completar el ciclo. */
const senescencia = (e: EstadoPlanta) =>
  e.etapa === 'cosecha' ? 0.9 : e.etapa === 'final' ? 0.25 + 0.5 * suave((e.progreso - 0.78) / 0.22) : 0;

const tieneFlor = (e: EstadoPlanta) => e.etapa === 'media' || e.etapa === 'final';
const tieneFruto = (e: EstadoPlanta) => e.etapa === 'final' || e.etapa === 'cosecha';

/** Acumula piezas con la paleta de la especie y el estado de la planta ya resueltos. */
class Constructor {
  readonly piezas: Pieza[] = [];
  readonly g: number;
  readonly hoja: string;
  readonly tallo: string;

  constructor(
    readonly e: EstadoPlanta,
    readonly c: PaletaPlanta,
  ) {
    this.g = crecimiento(e.progreso);
    // Estrés (salud < 70) y senescencia llevan el verde hacia el color seco
    const amarilleo = Math.max(senescencia(e), (70 - e.salud) / 70);
    this.hoja = mezclar(c.hoja, c.seca, amarilleo);
    this.tallo = mezclar(c.tallo, c.seca, amarilleo);
  }

  add(forma: Forma, pos: Vec3, esc: Vec3, color: string, rot: Vec3 = [0, 0, 0]): this {
    this.piezas.push({ forma, pos, rot, esc, color });
    return this;
  }

  /** Hoja alargada inclinada `inclinacion` rad hacia fuera, orientada a `angulo`. */
  hojaLarga(y: number, largo: number, ancho: number, angulo: number, inclinacion: number, color = this.hoja) {
    return this.add('caja', [0, y, 0], [ancho, largo, 0.012], color, [inclinacion, angulo, 0]);
  }
}

// ---------- Modelos por especie

/** Papa: mata baja y frondosa; flores lila en la etapa media; tubérculos al final. */
const papa: Modelo = (p) => {
  const { g, e, c } = p;
  const matas = e.etapa === 'siembra' ? 1 : e.etapa === 'germinacion' ? 2 : 5;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    p.add(
      'cilindro',
      [Math.cos(a) * 0.04 * g, 0, Math.sin(a) * 0.04 * g],
      [0.025, 0.28 * g, 0.025],
      p.tallo,
      [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3],
    );
  }
  for (let i = 0; i < matas; i++) {
    const a = (i / matas) * Math.PI * 2 + 0.4;
    const r = i === 0 ? 0 : 0.12 * g;
    const y = (i === 0 ? 0.3 : 0.22) * g;
    const t = (i === 0 ? 0.3 : 0.22) * g;
    p.add('esfera', [Math.cos(a) * r, y, Math.sin(a) * r], [t, t * 0.8, t], p.hoja);
  }
  if (tieneFlor(e) && e.etapa === 'media') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.add(
        'esfera',
        [Math.cos(a) * 0.1 * g, 0.44 * g, Math.sin(a) * 0.1 * g],
        [0.045, 0.045, 0.045],
        c.flor,
      );
    }
  }
  if (tieneFruto(e)) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1;
      p.add('esfera', [Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2], [0.09, 0.06, 0.07], c.fruto, [0, a, 0]);
    }
  }
};

/** Maíz: caña alta con hojas largas alternas; penacho en la etapa media; mazorca al final. */
const maiz: Modelo = (p) => {
  const { g, e, c } = p;
  const alto = 1.35 * g;
  p.add('cilindro', [0, 0, 0], [0.05, alto, 0.05], p.tallo);
  const nHojas = e.etapa === 'siembra' ? 1 : e.etapa === 'germinacion' ? 2 : 6;
  for (let i = 0; i < nHojas; i++) {
    const y = alto * (0.12 + (i / Math.max(nHojas, 1)) * 0.7);
    p.hojaLarga(y, 0.42 * g, 0.07, i * 2.4, 1.0 + (i % 2) * 0.15);
  }
  if (tieneFlor(e)) {
    for (let i = 0; i < 4; i++) {
      p.add('cono', [0, alto, 0], [0.025, 0.2 * g, 0.025], c.flor, [0.35, i * 1.57, 0]);
    }
  }
  if (tieneFruto(e)) {
    p.add('esfera', [0.07, alto * 0.52, 0], [0.07, 0.2, 0.07], c.fruto, [0, 0, -0.35]);
    p.add('cono', [0.04, alto * 0.45, 0], [0.08, 0.16, 0.08], p.hoja, [0, 0, -0.35]);
  }
};

/** Quinua: tallo erguido con hojas pequeñas; panoja roja en la etapa media que madura dorada. */
const quinua: Modelo = (p) => {
  const { g, e, c } = p;
  const alto = 1.05 * g;
  p.add('cilindro', [0, 0, 0], [0.04, alto, 0.04], p.tallo);
  const nHojas = e.etapa === 'siembra' ? 1 : e.etapa === 'germinacion' ? 2 : 6;
  for (let i = 0; i < nHojas; i++) {
    const y = alto * (0.15 + (i / Math.max(nHojas, 1)) * 0.6);
    const a = i * 2.1;
    p.add('esfera', [Math.cos(a) * 0.09 * g, y, Math.sin(a) * 0.09 * g], [0.11 * g, 0.03, 0.08 * g], p.hoja, [
      0,
      a,
      0.3,
    ]);
  }
  if (tieneFlor(e) || tieneFruto(e)) {
    const madura = tieneFruto(e) ? suave((e.progreso - 0.7) / 0.3) : 0;
    const color = mezclar(c.flor, c.fruto, madura);
    p.add('cono', [0, alto * 0.72, 0], [0.24, 0.42 * g, 0.24], color);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      p.add('esfera', [Math.cos(a) * 0.06, alto * 0.82, Math.sin(a) * 0.06], [0.07, 0.1, 0.07], color);
    }
  }
};

/** Haba: tres tallos erguidos con hojas en pares; flores blancas; vainas al final. */
const haba: Modelo = (p) => {
  const { g, e, c } = p;
  const alto = 0.8 * g;
  const tallos = e.etapa === 'siembra' ? 1 : 3;
  for (let s = 0; s < tallos; s++) {
    const a = (s / 3) * Math.PI * 2;
    const [x, z] = [Math.cos(a) * 0.08, Math.sin(a) * 0.08];
    const inclina: Vec3 = [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12];
    p.add('cilindro', [x, 0, z], [0.03, alto, 0.03], p.tallo, inclina);
    const pares = e.etapa === 'germinacion' ? 1 : 3;
    for (let i = 0; i < pares; i++) {
      const y = alto * (0.3 + i * 0.22);
      p.add('esfera', [x + 0.05, y, z], [0.08 * g, 0.025, 0.05 * g], p.hoja, [0, a, 0]);
      p.add('esfera', [x - 0.05, y, z], [0.08 * g, 0.025, 0.05 * g], p.hoja, [0, a, 0]);
    }
    if (tieneFlor(e) && e.etapa === 'media') {
      p.add('esfera', [x, alto * 0.62, z + 0.03], [0.04, 0.04, 0.04], c.flor);
      p.add('esfera', [x, alto * 0.8, z - 0.03], [0.04, 0.04, 0.04], c.flor);
    }
    if (tieneFruto(e)) {
      const vaina = e.etapa === 'cosecha' ? c.seca : c.fruto;
      p.add('esfera', [x + 0.04, alto * 0.45, z], [0.035, 0.15, 0.035], vaina, [0, 0, 0.5]);
      p.add('esfera', [x - 0.04, alto * 0.6, z], [0.035, 0.15, 0.035], vaina, [0, 0, -0.5]);
    }
  }
};

/** Avena: macolla de hojas finas; tallos con panículas colgantes que se doran al final. */
const avena: Modelo = (p) => {
  const { g, e, c } = p;
  const nHojas = e.etapa === 'siembra' ? 2 : e.etapa === 'germinacion' ? 4 : 9;
  for (let i = 0; i < nHojas; i++) {
    const a = (i / nHojas) * Math.PI * 2;
    p.add('cono', [Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03], [0.03, 0.6 * g, 0.03], p.hoja, [
      Math.sin(a) * 0.35,
      0,
      -Math.cos(a) * 0.35,
    ]);
  }
  if (tieneFlor(e) || tieneFruto(e)) {
    const color = tieneFruto(e) ? c.fruto : c.flor;
    for (let s = 0; s < 3; s++) {
      const a = (s / 3) * Math.PI * 2 + 0.5;
      const [x, z] = [Math.cos(a) * 0.06, Math.sin(a) * 0.06];
      p.add('cilindro', [x, 0, z], [0.015, 0.9 * g, 0.015], p.tallo);
      for (let k = 0; k < 4; k++) {
        p.add(
          'esfera',
          [x + Math.cos(a) * 0.05 * k, 0.9 * g - 0.06 * k, z + Math.sin(a) * 0.05 * k],
          [0.035, 0.05, 0.035],
          color,
        );
      }
    }
  }
};

/** Modelo por defecto (cultivo sin diseño propio): cono verde que crece. */
const generico: Modelo = (p) => {
  p.add('cono', [0, 0, 0], [0.3, 0.7 * p.g, 0.3], p.hoja);
};

const MODELOS: Record<string, Modelo> = {
  Papa: papa,
  'Maíz amiláceo': maiz,
  Quinua: quinua,
  'Haba (grano seco)': haba,
  'Avena forrajera': avena,
};

/** Paleta de respaldo para cultivos sin colores propios. */
const PALETA_GENERICA: PaletaPlanta = planta.Papa;

/** Anillo de etapa en la base: mantiene legible la leyenda "Etapa del cultivo" (design.md §3). */
const ANILLO: Pick<Pieza, 'forma' | 'pos' | 'rot' | 'esc'> = {
  forma: 'cilindro',
  pos: [0, 0, 0],
  rot: [0, 0, 0],
  esc: [0.5, 0.015, 0.5],
};

/** Estado de la vista previa de la fase de cultivos: planta adulta, sana, con frutos. */
export const ESTADO_PREVIA: EstadoPlanta = { etapa: 'final', progreso: 0.86, salud: 100, muerta: false };

export const tieneModeloPropio = (cultivo: string) => cultivo in MODELOS;

/** Piezas de la planta de `cultivo` en el estado dado (coordenadas locales de la celda). */
export function modeloPlanta(cultivo: string, estado: EstadoPlanta): Pieza[] {
  if (estado.muerta) {
    return [
      { forma: 'esfera', pos: [0, 0.03, 0], rot: [0, 0, 0], esc: [0.32, 0.06, 0.32], color: surface.roca },
    ];
  }
  const paleta = (planta as Record<string, PaletaPlanta | undefined>)[cultivo] ?? PALETA_GENERICA;
  const p = new Constructor(estado, paleta);
  (MODELOS[cultivo] ?? generico)(p);
  return [{ ...ANILLO, color: stageColor(estado.etapa) }, ...p.piezas];
}
