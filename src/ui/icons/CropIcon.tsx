/** Iconos de dominio como componentes estables: cultivo (con su color natural) y herramienta. */
import type { ToolId } from '@/domain/actions';
import type { IconoProps } from './base';
import { colorDeCultivo, dibujarCultivo, dibujarHerramienta } from './index';

export function CropIcon({ nombre, style, ...props }: IconoProps & { nombre: string }) {
  return dibujarCultivo(nombre, { ...props, style: { color: colorDeCultivo(nombre), ...style } });
}

export function ToolIcon({ tool, ...props }: IconoProps & { tool: ToolId }) {
  return dibujarHerramienta(tool, props);
}
