/**
 * Informe de recolección: al cosechar, resume TODO lo que se hizo en esas celdas durante el
 * ciclo (acciones, insumos, agua como tiempo de riego, mano de obra), cuánto costó, cuánto se
 * recuperó al vender y qué hacer con el suelo después (descanso o rotación).
 */
import type { Cosecha, ToolId } from '../actions';
import type { Crop } from '../crops';
import type { TileNode } from '../grid';
import type { Textura } from '../terrain';
import { FallowAdvisor, type Recomendacion } from './FallowAdvisor';
import { CONSUMO_POR_ACCION, HORAS_RIEGO, INSUMOS, economiaDe, type InsumoId } from './insumos';
import { registrosDelCiclo, type RegistroAccion } from './ledger';

export interface FilaAccion {
  tool: ToolId;
  /** Veces que se ejecutó (eventos) */
  veces: number;
  /** Aplicaciones celda a celda (suma de celdas de cada evento) */
  aplicaciones: number;
  /** Primer y último día en que se hizo */
  desde: number;
  hasta: number;
}

export interface FilaInsumo {
  insumo: InsumoId;
  nombre: string;
  cantidad: number;
  unidad: string;
  precio: number;
  costo: number;
}

export interface ReporteCosecha {
  id: string;
  plantacionId: string;
  cultivo: string;
  diaSiembra: number;
  diaCosecha: number;
  /** Primer día con una acción sobre estas celdas en el ciclo */
  diaInicio: number;
  areaM2: number;
  /** Número de celdas cosechadas (en la parcela real cada celda mide chunk² m²) */
  nCeldas: number;
  /** Rendimiento de referencia medio (t/ha) y su fuente; el real = referencia × salud */
  referenciaTHa: number;
  fuenteReferencia: string;
  /** Celdas cosechadas (para descanso o rotación) */
  tileIds: string[];
  acciones: FilaAccion[];
  insumos: FilaInsumo[];
  riego: { eventos: number; horas: number; litros: number };
  costoTotal: number;
  produccionKg: number;
  precioVenta: number;
  ingreso: number;
  balance: number;
  saludMedia: number;
  rendimientoTHa: number;
  recomendacion: Recomendacion;
}

export interface EntradaReporte {
  id: string;
  plantacion: { id: string; diaSiembra: number };
  crop: Crop;
  cosechas: readonly Cosecha[];
  diaCosecha: number;
  bitacora: readonly RegistroAccion[];
  /** Celdas cosechadas, ya con el suelo tras la cosecha */
  tilesDespues: readonly TileNode[];
  candidatos: readonly Crop[];
  textura?: Textura;
  /** Área de cada celda en m² (parcela real); por defecto 1 m² */
  areaDe?: (tileId: string) => number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export class HarvestReport {
  static generar(e: EntradaReporte): ReporteCosecha {
    const celdas = new Set(e.cosechas.map((c) => c.tileId));
    const area = e.areaDe ?? (() => 1);
    const registros = registrosDelCiclo(e.bitacora, celdas, e.plantacion.diaSiembra);
    const economia = economiaDe(e.crop.nombre);

    // Acciones: veces y aplicaciones celda a celda sobre el área cosechada
    const acciones = new Map<ToolId, FilaAccion>();
    const cantidades = new Map<InsumoId, number>();
    const sumar = (id: InsumoId, v: number) => cantidades.set(id, (cantidades.get(id) ?? 0) + v);
    const riego = { eventos: 0, horas: 0, litros: 0 };

    for (const r of registros) {
      const ids = r.tileIds.filter((id) => celdas.has(id));
      const n = ids.length;
      if (n === 0) continue;
      // insumos por m²: se multiplican por el área real de las celdas, no por su número
      const m2 = ids.reduce((a, id) => a + area(id), 0);
      const fila = acciones.get(r.tool) ?? {
        tool: r.tool,
        veces: 0,
        aplicaciones: 0,
        desde: r.dia,
        hasta: r.dia,
      };
      fila.veces++;
      fila.aplicaciones += n;
      fila.desde = Math.min(fila.desde, r.dia);
      fila.hasta = Math.max(fila.hasta, r.dia);
      acciones.set(r.tool, fila);

      for (const c of CONSUMO_POR_ACCION[r.tool]) sumar(c.insumo, c.cantidad * m2);
      if (r.tool === 'sembrar') sumar('semilla', economia.semillaKgM2 * m2);
      const horas = HORAS_RIEGO[r.tool];
      if (horas) {
        riego.eventos++;
        riego.horas += horas;
      }
    }
    riego.litros = cantidades.get('agua') ?? 0;

    const insumos: FilaInsumo[] = [...cantidades]
      .filter(([, cantidad]) => cantidad > 0)
      .map(([id, cantidad]) => {
        const precio = id === 'semilla' ? economia.precioSemilla : INSUMOS[id].precio;
        return {
          insumo: id,
          nombre: id === 'semilla' ? `Semilla de ${e.crop.nombre}` : INSUMOS[id].nombre,
          cantidad: r2(cantidad),
          unidad: INSUMOS[id].unidad,
          precio,
          costo: r2(cantidad * precio),
        };
      });

    const areaM2 = r2([...celdas].reduce((a, id) => a + area(id), 0));
    // referencia ponderada por área: kg reales / (salud × área)
    const refKg = e.cosechas.reduce((a, c) => a + (c.salud > 0 ? c.kg / (c.salud / 100) : 0), 0);
    const tilesRef = e.tilesDespues.length ? e.tilesDespues : [];
    const fuenteReferencia = tilesRef.some((t) => t.rendJuninTHa?.[e.crop.nombre] != null)
      ? 'motor de Junín (parcela real)'
      : 'Junín 2025';
    const produccionKg = r2(e.cosechas.reduce((a, c) => a + c.kg, 0));
    const costoTotal = r2(insumos.reduce((a, f) => a + f.costo, 0));
    const ingreso = r2(produccionKg * economia.precioVenta);
    const nSuelo = e.tilesDespues.length
      ? e.tilesDespues.reduce((a, t) => a + t.suelo.n, 0) / e.tilesDespues.length
      : 0;

    return {
      id: e.id,
      plantacionId: e.plantacion.id,
      cultivo: e.crop.nombre,
      diaSiembra: e.plantacion.diaSiembra,
      diaCosecha: e.diaCosecha,
      diaInicio: registros.length ? Math.min(...registros.map((r) => r.dia)) : e.plantacion.diaSiembra,
      areaM2,
      nCeldas: celdas.size,
      referenciaTHa: areaM2 ? r2((refKg / areaM2) * 10) : 0,
      fuenteReferencia,
      tileIds: [...celdas],
      acciones: [...acciones.values()].sort((a, b) => a.desde - b.desde),
      insumos,
      riego: { ...riego, litros: r2(riego.litros) },
      costoTotal,
      produccionKg,
      precioVenta: economia.precioVenta,
      ingreso,
      balance: r2(ingreso - costoTotal),
      saludMedia: e.cosechas.length
        ? Math.round(e.cosechas.reduce((a, c) => a + c.salud, 0) / e.cosechas.length)
        : 0,
      // kg/m² × 10 = t/ha
      rendimientoTHa: areaM2 ? r2((produccionKg / areaM2) * 10) : 0,
      recomendacion: FallowAdvisor.recomendar(e.crop, nSuelo, e.candidatos, e.textura),
    };
  }
}
