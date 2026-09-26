/**
 * Base de los iconos de dominio: un <svg> accesible que hereda tamaño (1em) y color
 * (`currentColor`) del texto. Con `title` se anuncia; sin él es decorativo.
 */
import type { ReactNode, SVGProps } from 'react';

export type IconoProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { title?: string };

export type Icono = (props: IconoProps) => ReactNode;

export function Svg({
  viewBox,
  ancho = 1,
  title,
  children,
  ...props
}: IconoProps & { viewBox: string; ancho?: number; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={`${ancho}em`}
      height="1em"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
