/**
 * Detalle del cultivo de UNA celda: en qué etapa está, cuánto le falta, cómo está de salud
 * y de agua, qué lo estresa hoy y cuánto rendiría si se cosechara al llegar a su fin.
 * Vista de solo lectura sobre el dominio (no muta la celda).
 */
import type { Crop, EtapaVisual } from '../crops';
import type { TileNode } from '../grid';
import { efectoEnCultivo, estadoHidrico, type EfectoHidrico, type EstadoHidrico } from '../hydrology';
import { chiEstado, type ChiEstado, type HealthModel, type StressEffect } from '../stress';
import type { ClimaHoy } from './PlantationService';

export interface DetalleCultivo {
  cultivo: string;
  variedad: string;
  etapa: EtapaVisual;
  /** 0–1 del ciclo (según días de desarrollo) */
  progreso: number;
  /** Días de desarrollo acumulados (el estrés los ralentiza) */
  diasDesarrollo: number;
  /** Días de calendario desde la siembra; null si no se conoce la plantación */
  diasDesdeSiembra: number | null;
  cicloDias: number;
  /** Día de desarrollo desde el que se puede cosechar */
  inicioFinal: number;
  /** Días de desarrollo que faltan para poder cosechar (0 si ya está madura) */
  faltanParaCosecha: number;
  maduro: boolean;
  muerta: boolean;
  salud: number;
  estadoSalud: ChiEstado;
  humedad: number;
  /** Humedad mínima sin estrés: (1 − p)·100 */
  umbralHumedad: number;
  estadoHidrico: EstadoHidrico;
  efectoHidrico: EfectoHidrico;
  kcHoy: number;
  /** Consumo potencial de hoy: Kc · ET0 (mm) */
  etcHoy: number;
  lluviaHoy: number;
  /** Lo que afecta hoy a la planta; vacío = sin estrés (se recupera) */
  efectos: StressEffect[];
  /** Rendimiento de referencia Junín 2025 en la celda de 1 m² (kg) */
  rendimientoRefKg: number;
  /** Referencia × salud actual (kg) */
  rendimientoEstimadoKg: number;
  plantacionId: string | null;
}

export class CropCellInspector {
  constructor(private readonly health: HealthModel) {}

  detalle(
    tile: TileNode,
    crop: Crop,
    clima: ClimaHoy,
    saturacionPct: number,
    plantacion: { id: string; diaSiembra: number } | null,
    diaActual: number,
  ): DetalleCultivo {
    const estadoH = estadoHidrico(tile.humedad, tile.aguaSuperficie, saturacionPct);
    const muerta = tile.salud <= 0;
    const kcHoy = crop.kc(tile.diasCultivo);
    const efectos = muerta
      ? []
      : this.health.efectos(
          {
            tmed: clima.tmed,
            tmin: clima.tmin,
            humedad: tile.humedad,
            umbralHumedad: crop.umbralHumedad,
            encharcado: estadoH === 'encharcado',
            diasEncharcado: tile.diasEncharcado,
          },
          crop.datos,
        );

    return {
      cultivo: crop.nombre,
      variedad: crop.datos.variedad,
      etapa: crop.etapaEn(tile.diasCultivo),
      progreso: Math.min(1, tile.diasCultivo / crop.cicloDias),
      diasDesarrollo: tile.diasCultivo,
      diasDesdeSiembra: plantacion ? diaActual - plantacion.diaSiembra : null,
      cicloDias: crop.cicloDias,
      inicioFinal: crop.inicioFinal,
      faltanParaCosecha: Math.max(0, Math.ceil(crop.inicioFinal - tile.diasCultivo)),
      maduro: tile.estado === 'maduro',
      muerta,
      salud: tile.salud,
      estadoSalud: chiEstado(tile.salud),
      humedad: tile.humedad,
      umbralHumedad: crop.umbralHumedad,
      estadoHidrico: estadoH,
      efectoHidrico: efectoEnCultivo(estadoH, tile.humedad, crop.umbralHumedad),
      kcHoy,
      etcHoy: kcHoy * clima.et0,
      lluviaHoy: clima.lluviaMm,
      efectos,
      rendimientoRefKg: crop.rendimientoRefKgM2,
      rendimientoEstimadoKg: crop.rendimientoRefKgM2 * (tile.salud / 100),
      plantacionId: plantacion?.id ?? null,
    };
  }
}
