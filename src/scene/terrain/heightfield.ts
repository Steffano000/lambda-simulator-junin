/**
 * Fase 5 · Superficie continua del terreno (funciones puras, sin Three.js).
 *
 * Coordenadas de grilla: la celda (fila r, columna c) ocupa [c, c+1] × [r, r+1].
 * - Las alturas de las celdas se pasan a los VÉRTICES (esquinas) promediando las celdas vecinas
 *   que existen; así la superficie es continua y no escalonada.
 * - Suavizado opcional: pasadas de Laplaciano (cada vértice se acerca al promedio de sus vecinos).
 *   En el interior, un plano o una rampa no cambian.
 * - alturaEn(x, z): interpolación bilineal dentro de la celda.
 * - pendienteCelda(): pendiente por diferencias finitas sobre la superficie, en grados reales
 *   (la escena usa 1 u = un chunk en horizontal y alturas × exageración).
 * - recortarCuadrado(): la parte de la celda dentro del polígono de la parcela (borde vectorial).
 */

export type Punto2 = [number, number];

export interface Heightfield {
  rows: number;
  cols: number;
  /** (rows + 1) × (cols + 1) alturas de vértice; NaN donde no hay ninguna celda vecina */
  v: Float64Array;
}

const idx = (cols: number, r: number, c: number) => r * (cols + 1) + c;

/**
 * @param alturas alturas de las celdas (fila por fila); null = celda que no se dibuja
 * @param suavizado pasadas de suavizado (0-3)
 */
export function construirHeightfield(
  rows: number,
  cols: number,
  alturas: readonly (number | null)[],
  suavizado = 0,
): Heightfield {
  let v = new Float64Array((rows + 1) * (cols + 1)).fill(NaN);
  /** Vértices con sus 4 celdas vecinas: solo esos sirven de vecinos al suavizar (en el borde el
   *  promedio no es lineal y deformaría una rampa) */
  const completo = new Uint8Array((rows + 1) * (cols + 1));
  for (let r = 0; r <= rows; r++)
    for (let c = 0; c <= cols; c++) {
      let s = 0;
      let n = 0;
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 0],
        [0, -1],
        [0, 0],
      ]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const h = alturas[rr * cols + cc];
        if (h == null) continue;
        s += h;
        n++;
      }
      if (n) v[idx(cols, r, c)] = s / n;
      if (n === 4) completo[idx(cols, r, c)] = 1;
    }
  for (let p = 0; p < suavizado; p++) {
    const w = new Float64Array(v);
    for (let r = 0; r <= rows; r++)
      for (let c = 0; c <= cols; c++) {
        const h = v[idx(cols, r, c)];
        if (Number.isNaN(h)) continue;
        let s = 0;
        let n = 0;
        // vecinos en cruz y su opuesto: solo se promedian pares completos, así un plano o una
        // rampa no se deforman tampoco en el borde de la parcela
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ]) {
          const a = v[idx(cols, r + dr, c + dc)];
          const b = v[idx(cols, r - dr, c - dc)];
          const dentroA = r + dr <= rows && c + dc <= cols && completo[idx(cols, r + dr, c + dc)];
          const dentroB = r - dr >= 0 && c - dc >= 0 && completo[idx(cols, r - dr, c - dc)];
          if (dentroA && dentroB && !Number.isNaN(a) && !Number.isNaN(b)) {
            s += a + b;
            n += 2;
          }
        }
        if (n) w[idx(cols, r, c)] = 0.5 * h + 0.5 * (s / n);
      }
    v = w;
  }
  return { rows, cols, v };
}

/** Altura de un vértice; si no existe, la del vértice válido más cercano de la misma celda */
function vert(hf: Heightfield, r: number, c: number, respaldo: number): number {
  const rr = Math.min(hf.rows, Math.max(0, r));
  const cc = Math.min(hf.cols, Math.max(0, c));
  const h = hf.v[idx(hf.cols, rr, cc)];
  return Number.isNaN(h) ? respaldo : h;
}

/** Altura bilineal en (x, z) de grilla */
export function alturaEn(hf: Heightfield, x: number, z: number): number {
  const c = Math.min(hf.cols - 1, Math.max(0, Math.floor(x)));
  const r = Math.min(hf.rows - 1, Math.max(0, Math.floor(z)));
  const tx = Math.min(1, Math.max(0, x - c));
  const tz = Math.min(1, Math.max(0, z - r));
  const esquinas = [
    hf.v[idx(hf.cols, r, c)],
    hf.v[idx(hf.cols, r, c + 1)],
    hf.v[idx(hf.cols, r + 1, c)],
    hf.v[idx(hf.cols, r + 1, c + 1)],
  ];
  const validas = esquinas.filter((h) => !Number.isNaN(h));
  const prom = validas.length ? validas.reduce((a, b) => a + b, 0) / validas.length : 0;
  const a = vert(hf, r, c, prom);
  const b = vert(hf, r, c + 1, prom);
  const d = vert(hf, r + 1, c, prom);
  const e = vert(hf, r + 1, c + 1, prom);
  return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + d * (1 - tx) * tz + e * tx * tz;
}

/** Gradiente (dh/dx, dh/dz) de la superficie bilineal en (x, z), por unidad de grilla */
export function gradienteEn(hf: Heightfield, x: number, z: number, paso = 0.25): [number, number] {
  return [
    (alturaEn(hf, x + paso, z) - alturaEn(hf, x - paso, z)) / (2 * paso),
    (alturaEn(hf, x, z + paso) - alturaEn(hf, x, z - paso)) / (2 * paso),
  ];
}

/**
 * Pendiente de la celda (grados reales) por diferencias finitas entre sus cuatro esquinas.
 * En la escena 1 u horizontal = 1 chunk y 1 u vertical = 1 chunk / exageración, así que
 * tan(pendiente) = |∇h| / exageración.
 */
export function pendienteCelda(hf: Heightfield, r: number, c: number, exageracion: number): number | null {
  const a = hf.v[idx(hf.cols, r, c)];
  const b = hf.v[idx(hf.cols, r, c + 1)];
  const d = hf.v[idx(hf.cols, r + 1, c)];
  const e = hf.v[idx(hf.cols, r + 1, c + 1)];
  if ([a, b, d, e].some(Number.isNaN)) return null;
  const gx = (b + e - a - d) / 2;
  const gz = (d + e - a - b) / 2;
  return (Math.atan(Math.hypot(gx, gz) / (exageracion || 1)) * 180) / Math.PI;
}

/** Parte del polígono dentro del cuadrado [x0, x1] × [z0, z1] (Sutherland-Hodgman) */
export function recortarCuadrado(
  poli: readonly Punto2[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): Punto2[] {
  let out: Punto2[] = [...poli];
  const bordes: [(p: Punto2) => boolean, (a: Punto2, b: Punto2) => Punto2][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= z0, (a, b) => [a[0] + ((b[0] - a[0]) * (z0 - a[1])) / (b[1] - a[1]), z0]],
    [(p) => p[1] <= z1, (a, b) => [a[0] + ((b[0] - a[0]) * (z1 - a[1])) / (b[1] - a[1]), z1]],
  ];
  for (const [dentro, cruce] of bordes) {
    const entrada = out;
    out = [];
    for (let i = 0; i < entrada.length; i++) {
      const a = entrada[i];
      const b = entrada[(i + 1) % entrada.length];
      if (dentro(b)) {
        if (!dentro(a)) out.push(cruce(a, b));
        out.push(b);
      } else if (dentro(a)) out.push(cruce(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

/** Área de un polígono (fórmula del zapato) */
export const areaPoligono = (p: readonly Punto2[]): number =>
  Math.abs(p.reduce((s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1], 0)) /
  2;
