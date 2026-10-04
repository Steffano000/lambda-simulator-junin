/**
 * Estado del modo Junín (geovisor NASA + simulador local). Store aparte del simulador 3D:
 * solo datos; las intenciones pasan por JuninController.
 */
import { create } from 'zustand';
import type { GeoJSON } from '@/data/junin/JuninDataSource';
import type { EscenarioId, GrillaCapas, NucleoJunin, Parcela } from '@/data/junin/types';
import type { Anillo, GrillaChunks, ResumenParcela } from '@/domain/junin/parcela';
import type { CapaDato, ResumenResolucion } from '@/domain/junin/resolucion';
import { limiteDispositivo, type LimiteDispositivo } from '@/data/junin/dispositivo';
import type { ResultadoRendimiento } from '@/domain/junin/simulador';

export type Modo = 'junin' | 'simulador';
/** Imagen de fondo: alta resolución para dibujar (esri, eox) o NASA del día (modis, viirs, hls) */
export type BaseNasa = 'esri' | 'eox' | 'modis' | 'viirs' | 'hls';
export type OverlayNasa = 'ndvi' | 'humedad' | 'lluvia' | 'etiquetas';
export type CapaChunk =
  | 'estado'
  | 'fidelidad'
  | 'regla'
  | 'cobertura'
  | 'elevacion'
  | 'pendiente'
  | 'textura'
  | 'ph'
  | 'ndvi'
  | 'rendimiento';

export interface PasoRotacion {
  campana: number;
  cultivo: string;
  nombre: string;
  anterior: string | null;
  rend_t_ha: number;
  produccion_t: number;
  motor: string;
}

export interface UbicacionParcela {
  punto: string;
  distancia_km: number;
  provincia: string;
  piso: string | null;
  fuera_de_junin: boolean;
  area_protegida: string | null;
}

export interface EstadoCasas {
  estado: 'ok' | 'error' | 'omitido';
  /** OSM no respondió y se usa la última copia buena guardada */
  respaldo?: boolean;
  n: number;
  mensaje: string;
  fuente: string;
  consultado: string;
  contornos: [number, number][][];
}

export interface JuninState {
  modo: Modo;
  cargando: string | null;
  error: string | null;
  nucleo: NucleoJunin | null;
  grilla: GrillaCapas | null;
  parcelas: Parcela[];
  region: GeoJSON | null;
  provincias: GeoJSON | null;
  protegidas: GeoJSON | null;
  /** Fecha de la imagen NASA (YYYY-MM-DD) */
  fecha: string;
  base: BaseNasa;
  overlays: Record<OverlayNasa, boolean>;
  verProtegidas: boolean;
  /** Teselas NASA que fallaron (capa sin imagen para la fecha) */
  avisoTeselas: string | null;
  dibujando: boolean;
  borrador: Anillo;
  anillo: Anillo | null;
  area_ha: number;
  chunks: GrillaChunks | null;
  resumen: ResumenParcela | null;
  ubicacion: UbicacionParcela | null;
  /** Casas consultadas en vivo (OpenStreetMap); null mientras no se consulta */
  casas: EstadoCasas | null;
  capaChunk: CapaChunk;
  /** Capa cuya fidelidad se pinta ('peor' = la más baja de uso de suelo, relieve y suelo) */
  capaFidelidad: CapaDato | 'peor';
  /** Tamaño de chunk elegido; null = automático (recomendado para este equipo) */
  celdaElegida: number | null;
  /** Límite de chunks por lado según el equipo */
  limite: LimiteDispositivo;
  /** Resolución efectiva de la parcela (Fase 2) */
  resolucion: ResumenResolucion | null;
  escenario: EscenarioId;
  cultivo: string | null;
  anterior: string | null;
  campana: number;
  plan: PasoRotacion[];
  /** null = sin comprobar; false = no hay servidor (Fase 1) */
  servidor: boolean | null;
  ultimoResultado: ResultadoRendimiento | null;
  /** Fase 6: frescura de los datos locales */
  frescura: {
    /** Fecha en que el pipeline generó public/data/junin */
    generado: string | null;
    /** Último mes con clima observado (lo demás es pronóstico) */
    ultimo_mes_observado: string | null;
    /** Fecha de descarga más reciente por paso del pipeline */
    descargas: Record<string, string>;
    /** Cuándo cargó (o recargó) la app sus datos locales */
    cargado: string | null;
  };
}

const ayer = () => {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

export const useJuninStore = create<JuninState>()(() => ({
  modo: 'junin',
  cargando: null,
  error: null,
  nucleo: null,
  grilla: null,
  parcelas: [],
  region: null,
  provincias: null,
  protegidas: null,
  fecha: ayer(),
  base: 'esri',
  overlays: { ndvi: false, humedad: false, lluvia: false, etiquetas: true },
  verProtegidas: false,
  avisoTeselas: null,
  dibujando: false,
  borrador: [],
  anillo: null,
  area_ha: 0,
  chunks: null,
  resumen: null,
  ubicacion: null,
  casas: null,
  capaChunk: 'regla',
  capaFidelidad: 'peor',
  celdaElegida: null,
  limite: limiteDispositivo(),
  resolucion: null,
  escenario: 'actual',
  cultivo: null,
  anterior: null,
  campana: 0,
  plan: [],
  servidor: null,
  ultimoResultado: null,
  frescura: { generado: null, ultimo_mes_observado: null, descargas: {}, cargado: null },
}));
