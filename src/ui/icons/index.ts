/**
 * Registro de iconos de dominio: resuelve un icono a partir de una herramienta, un
 * cultivo o una variable del clima, sin condicionales en las vistas.
 * Un icono nuevo = una entrada aquí; la vista usa <CropIcon>, <ToolIcon> o VARIABLE_CLIMA.
 */
import type { ToolId } from '@/domain/actions';
import { planta, type PaletaPlanta } from '@/theme/tokens';
import type { Icono, IconoProps } from './base';
import {
  IconAbonoOrganico,
  IconAbonoQuimico,
  IconAcidificar,
  IconArar,
  IconCanal,
  IconCosechar,
  IconDescansar,
  IconDrenar,
  IconEncalar,
  IconInundar,
  IconRegar,
  IconRemover,
  IconSembrar,
} from './actionIcons';
import { IconAvena, IconHaba, IconMaiz, IconPapa, IconQuinua } from './cropIcons';
import {
  IconDeficitHidrico,
  IconEvapotranspiracion,
  IconLluvia,
  IconTempMaxima,
  IconTempMinima,
} from './weatherIcons';

export type { Icono, IconoProps } from './base';
export * from './actionIcons';
export * from './cropIcons';
export * from './weatherIcons';

const PorHerramienta: Record<ToolId, Icono> = {
  arar: IconArar,
  encalar: IconEncalar,
  acidificar: IconAcidificar,
  'abonar-organico': IconAbonoOrganico,
  'abonar-quimico': IconAbonoQuimico,
  regar: IconRegar,
  inundar: IconInundar,
  drenar: IconDrenar,
  canal: IconCanal,
  sembrar: IconSembrar,
  cosechar: IconCosechar,
  remover: IconRemover,
  descansar: IconDescansar,
};

/** Clave = `nombre` de data/cultivos.json. */
const PorCultivo: Record<string, Icono> = {
  Papa: IconPapa,
  'Maíz amiláceo': IconMaiz,
  Quinua: IconQuinua,
  'Haba (grano seco)': IconHaba,
  'Avena forrajera': IconAvena,
};

/** Color del icono de cada cultivo (tokens `planta`); los multicolor ignoran `currentColor`. */
export const colorDeCultivo = (nombre: string): string | undefined =>
  (planta as Record<string, PaletaPlanta | undefined>)[nombre]?.fruto;

export const VARIABLE_CLIMA = {
  lluvia: IconLluvia,
  tmed: IconTempMaxima,
  tmin: IconTempMinima,
  et: IconEvapotranspiracion,
  deficit: IconDeficitHidrico,
} as const satisfies Record<string, Icono>;

/**
 * Dibuja el icono de una herramienta o de un cultivo. Los iconos son funciones puras (sin
 * hooks): se invocan directamente en vez de montar un componente elegido en el render.
 */
export const dibujarHerramienta = (tool: ToolId, props: IconoProps = {}) => PorHerramienta[tool](props);

export const dibujarCultivo = (nombre: string, props: IconoProps = {}) =>
  (PorCultivo[nombre] ?? IconSembrar)(props);
