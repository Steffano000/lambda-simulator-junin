/**
 * Lectura de grillas y parcelas de public/data/junin.
 * Las grillas son arreglos planos fila por fila (norte → sur, oeste → este);
 * si una capa trae `escala`, el valor real es dato / escala.
 */
import type { CabeceraGrilla, CapaGrilla, GrillaCapas, Parcela, ReglaUso } from '@/data/junin/types';

/** Índice de la celda que contiene (lat, lon), o null si cae fuera */
export function indiceEnGrilla(g: CabeceraGrilla, lat: number, lon: number): number | null {
  const [oeste, , , norte] = g.bbox;
  const col = Math.floor((lon - oeste) / g.resolucion_grados);
  const fila = Math.floor((norte - lat) / g.resolucion_grados);
  if (col < 0 || fila < 0 || col >= g.ancho || fila >= g.alto) return null;
  return fila * g.ancho + col;
}

/** Valor real de una celda (aplica la escala) */
export function valorCapa(capa: CapaGrilla, i: number): number | null {
  const v = capa.datos[i];
  if (v == null) return null;
  return capa.escala ? v / capa.escala : v;
}

/** Valor de una capa en (lat, lon) */
export function valorEnGrilla(g: GrillaCapas, capa: string, lat: number, lon: number): number | null {
  const c = g.capas[capa];
  const i = indiceEnGrilla(g, lat, lon);
  return c && i != null ? valorCapa(c, i) : null;
}

/** Todas las capas de la grilla de Junín en un punto (lo que antes daba GET /terreno) */
export function terrenoEnPunto(
  g: GrillaCapas,
  lat: number,
  lon: number,
): Record<string, number | string | null> | null {
  const i = indiceEnGrilla(g, lat, lon);
  if (i == null) return null;
  const out: Record<string, number | string | null> = {};
  for (const [nombre, capa] of Object.entries(g.capas)) out[nombre] = valorCapa(capa, i);
  const clases = g.leyendas?.textura_app as string[] | undefined;
  if (clases && typeof out.textura_app === 'number') out.textura_app = clases[out.textura_app] ?? null;
  return out;
}

export interface CeldaParcela {
  fila: number;
  columna: number;
  elevacion_m: number | null;
  pendiente_grados: number | null;
  /** Clase de data/terrenos.json (null en zona urbana o agua, donde SoilGrids no tiene dato) */
  textura: string | null;
  ph: number | null;
  cos_pct: number | null;
  arena_pct: number | null;
  arcilla_pct: number | null;
  worldcover: number | null;
  regla: ReglaUso | null;
  ndvi: number | null;
}

/** Parcela real (40 × 40 celdas de 30 m) → celdas para la grilla 3D */
export function celdasDeParcela(p: Parcela): CeldaParcela[] {
  const c = p.capas;
  const celdas: CeldaParcela[] = [];
  for (let fila = 0; fila < p.filas; fila++) {
    for (let columna = 0; columna < p.columnas; columna++) {
      const i = fila * p.columnas + columna;
      celdas.push({
        fila,
        columna,
        elevacion_m: valorCapa(c.elevacion_m, i),
        pendiente_grados: valorCapa(c.pendiente_grados, i),
        textura: c.textura_app.datos[i] ?? null,
        ph: valorCapa(c.ph, i),
        cos_pct: valorCapa(c.cos_pct, i),
        arena_pct: valorCapa(c.arena_pct, i),
        arcilla_pct: valorCapa(c.arcilla_pct, i),
        worldcover: valorCapa(c.worldcover, i),
        regla: c.regla_uso.datos[i] ?? null,
        ndvi: valorCapa(c.ndvi_ultimo_anio, i),
      });
    }
  }
  return celdas;
}

/** Recorta una ventana n × n centrada de la parcela (la grilla de la app va de 8×8 a 40×40) */
export function ventanaCentral<T extends { fila: number; columna: number }>(
  celdas: T[],
  total: number,
  n: number,
): T[] {
  const ini = Math.floor((total - n) / 2);
  return celdas
    .filter((c) => c.fila >= ini && c.fila < ini + n && c.columna >= ini && c.columna < ini + n)
    .map((c) => ({ ...c, fila: c.fila - ini, columna: c.columna - ini }));
}

/**
 * Regla de la parcela (reglas_uso_suelo.json): si más del 50 % es 'bloqueado' no se siembra;
 * si hay celdas en 'advertencia' se avisa.
 */
export function evaluarParcela(celdas: { regla: ReglaUso | null }[]): {
  puede_sembrar: boolean;
  pct: Record<ReglaUso, number>;
  advertencia: boolean;
} {
  const validas = celdas.filter((c) => c.regla);
  const n = validas.length || 1;
  const pct = { permitido: 0, advertencia: 0, bloqueado: 0 } as Record<ReglaUso, number>;
  for (const c of validas) pct[c.regla!] += 100 / n;
  for (const k of Object.keys(pct) as ReglaUso[]) pct[k] = Math.round(pct[k] * 10) / 10;
  return { puede_sembrar: pct.bloqueado <= 50, pct, advertencia: pct.advertencia > 0 };
}

/** Piso ecológico por altitud (catalogo.pisos_ecologicos) */
export function pisoEcologico(
  elevacion: number,
  pisos: { id: string; nombre: string; alt_min_m: number; alt_max_m: number }[],
): string | null {
  return pisos.find((p) => elevacion >= p.alt_min_m && elevacion < p.alt_max_m)?.id ?? null;
}
