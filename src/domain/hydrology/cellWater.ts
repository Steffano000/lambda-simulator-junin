/**
 * Puente celda ↔ balance hídrico: arma el `Suelo` de una celda (propiedades, capacidad de
 * la capa activa y surcos) y aplica entradas de agua devolviendo la celda actualizada.
 * Lo usan por igual el riego (acción del usuario) y la lluvia (evento del clima).
 */
import type { TileNode } from '../grid';
import { PROFUNDIDAD_SUELO_M, SoilHydraulics, type PropiedadesHidricas } from './SoilHydraulics';
import { WaterBalance, type EntradaAgua, type Suelo } from './WaterBalance';

/** Surcos activos: solo en suelo trabajado con cultivo o listo para sembrar. */
export const tieneSurcos = (t: TileNode): boolean =>
  t.surcos !== null && (t.estado === 'arado' || t.estado === 'sembrado' || t.estado === 'maduro');

/** `raizM` = profundidad de raíces si hay cultivo; si no, la capa superficial. */
export function sueloDeCelda(t: TileNode, props: PropiedadesHidricas, raizM?: number): Suelo {
  return {
    props,
    capacidadMm: SoilHydraulics.capacidadMm(props, raizM ?? PROFUNDIDAD_SUELO_M),
    conSurcos: tieneSurcos(t),
  };
}

export function aplicarAgua(
  t: TileNode,
  mm: number,
  horas: number,
  suelo: Suelo,
): { tile: TileNode; entrada: EntradaAgua } {
  const entrada = WaterBalance.aplicar(
    { humedad: t.humedad, aguaSuperficie: t.aguaSuperficie },
    mm,
    horas,
    suelo,
  );
  return {
    tile: {
      ...t,
      humedad: +entrada.estado.humedad.toFixed(1),
      aguaSuperficie: +entrada.estado.aguaSuperficie.toFixed(1),
    },
    entrada,
  };
}
