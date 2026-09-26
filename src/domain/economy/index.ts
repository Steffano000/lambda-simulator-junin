/**
 * Economía de la plantación: bitácora de acciones, insumos y precios, informe de
 * recolección (gasto, venta, balance) y recomendación de descanso o rotación del suelo.
 */
export { FallowAdvisor, nMinimoDe, type Alternativa, type Recomendacion } from './FallowAdvisor';
export {
  HarvestReport,
  type EntradaReporte,
  type FilaAccion,
  type FilaInsumo,
  type ReporteCosecha,
} from './HarvestReport';
export {
  CONSUMO_POR_ACCION,
  ECONOMIA_CULTIVO,
  HORAS_RIEGO,
  INSUMOS,
  economiaDe,
  type Consumo,
  type EconomiaCultivo,
  type Insumo,
  type InsumoId,
} from './insumos';
export { registrosDelCiclo, type RegistroAccion } from './ledger';
