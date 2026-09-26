/** Escalas y geometría compartidas por las gráficas mensuales (un solo eje Y por gráfica). */

export const MESES_CORTOS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

export interface Marco {
  ancho: number;
  alto: number;
  izq: number;
  der: number;
  arriba: number;
  abajo: number;
}

export const marco = (ancho: number, alto: number, compacto = false): Marco => ({
  ancho,
  alto,
  izq: compacto ? 4 : 36,
  der: 6,
  arriba: 6,
  abajo: compacto ? 4 : 18,
});

/** Máximo "redondo" para el eje (múltiplo de `paso`). */
export const techo = (valor: number, paso: number) => Math.max(paso, Math.ceil(valor / paso) * paso);

/** Centro X de la banda del mes i (0–11). */
export const xMes = (m: Marco, i: number) => m.izq + ((m.ancho - m.izq - m.der) / 12) * (i + 0.5);

export const anchoBanda = (m: Marco) => (m.ancho - m.izq - m.der) / 12;

/** Y para un valor en [min, max]. */
export const yValor = (m: Marco, v: number, min: number, max: number) =>
  m.arriba + (1 - (v - min) / (max - min)) * (m.alto - m.arriba - m.abajo);

/** Rectángulo con esquinas superiores redondeadas anclado a la base (marca de barra). */
export function barra(x: number, y: number, w: number, base: number, r = 3): string {
  const h = base - y;
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${base}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${base}Z`;
}

export const ticks = (min: number, max: number, n = 4) =>
  Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);
