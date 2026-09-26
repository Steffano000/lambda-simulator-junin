/**
 * Paso 02 · Tratamientos del suelo (EP-05.1): arado y enmiendas que preparan la celda para
 * cumplir los requisitos de siembra. El manejo del agua está en ./riego.ts. Las cantidades son parámetros de simulación ajustables.
 */
import type { RequirementId } from '../../crops';
import type { TileNode } from '../../grid';
import { TileCommand, type ActionContext, type CategoriaAccion } from '../TileCommand';

/** Aporte por aplicación de abono (ppm de N-P-K, % de materia orgánica). */
export const ABONOS = {
  organico: { n: 10, p: 5, k: 10, mo: 0.5 },
  quimico: { n: 30, p: 15, k: 20, mo: 0 },
} as const;

/** Enmiendas de pH por aplicación y límites. */
export const ENMIENDAS = { deltaPh: 0.5, phMax: 8.5, phMin: 4.5 } as const;

const ocupada = (t: TileNode): string | null => {
  if (t.canal) return 'La celda tiene un canal de riego.';
  if (t.vegetacionId) return 'La celda tiene un cultivo; trate antes de sembrar.';
  return null;
};

abstract class Tratamiento extends TileCommand {
  readonly categoria: CategoriaAccion = 'tratamiento';
}

export class ArarCommand extends Tratamiento {
  readonly id = 'arar';
  readonly etiqueta = 'Arar';
  readonly descripcion = 'Voltea y descompacta el suelo y abre surcos para la semilla y el agua.';
  readonly efectos = [
    'Estado: Baldío/Cosechado → Arado',
    'Abre surcos y lomos en la dirección elegida',
    'Los surcos guardan agua de lluvia y riego (hasta 50 mm) y mejoran la absorción',
  ];
  readonly prerrequisitos = ['Sin cultivo (coseche o remueva antes)', 'Sin canal de riego'];
  readonly resuelve = ['preparacion'] as const;
  readonly exito = 'Suelo arado y listo para sembrar.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (t.canal) return 'La celda tiene un canal de riego.';
    if (t.descansoHasta !== null && ctx.dia < t.descansoHasta) {
      return `El suelo descansa hasta el día ${t.descansoHasta}.`;
    }
    if (t.estado === 'maduro') return 'Coseche antes de arar.';
    if (t.vegetacionId) return 'Remueva el cultivo antes de arar.';
    if (t.estado === 'arado') return 'La celda ya está arada.';
    return null;
  }

  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    return { ...t, estado: 'arado', surcos: ctx.direccionArado };
  }
}

export class EncalarCommand extends Tratamiento {
  readonly id = 'encalar';
  readonly etiqueta = 'Encalar';
  readonly descripcion = 'Aplica cal agrícola para corregir la acidez del suelo.';
  readonly efectos = [`pH +${ENMIENDAS.deltaPh} por aplicación (máx. ${ENMIENDAS.phMax})`];
  readonly prerrequisitos = ['Sin cultivo', `pH < ${ENMIENDAS.phMax - ENMIENDAS.deltaPh}`];
  readonly resuelve = ['ph-bajo'] as const;
  readonly exito = 'Cal aplicada: el pH subió.';

  protected validate(t: TileNode): string | null {
    return (
      ocupada(t) ?? (t.suelo.ph >= ENMIENDAS.phMax - ENMIENDAS.deltaPh ? 'El suelo ya es alcalino.' : null)
    );
  }

  protected apply(t: TileNode): TileNode {
    const ph = Math.min(ENMIENDAS.phMax, t.suelo.ph + ENMIENDAS.deltaPh);
    return { ...t, suelo: { ...t.suelo, ph: +ph.toFixed(1) } };
  }
}

export class AcidificarCommand extends Tratamiento {
  readonly id = 'acidificar';
  readonly etiqueta = 'Acidificar';
  readonly descripcion = 'Aplica azufre elemental para bajar el pH de suelos alcalinos.';
  readonly efectos = [`pH −${ENMIENDAS.deltaPh} por aplicación (mín. ${ENMIENDAS.phMin})`];
  readonly prerrequisitos = ['Sin cultivo', `pH > ${ENMIENDAS.phMin + ENMIENDAS.deltaPh}`];
  readonly resuelve = ['ph-alto'] as const;
  readonly exito = 'Azufre aplicado: el pH bajó.';

  protected validate(t: TileNode): string | null {
    return ocupada(t) ?? (t.suelo.ph <= ENMIENDAS.phMin + ENMIENDAS.deltaPh ? 'El suelo ya es ácido.' : null);
  }

  protected apply(t: TileNode): TileNode {
    const ph = Math.max(ENMIENDAS.phMin, t.suelo.ph - ENMIENDAS.deltaPh);
    return { ...t, suelo: { ...t.suelo, ph: +ph.toFixed(1) } };
  }
}

export class AbonarCommand extends Tratamiento {
  readonly id: string;
  readonly etiqueta: string;
  readonly descripcion: string;
  readonly efectos: readonly string[];
  readonly prerrequisitos = ['Celda arada (el abono se incorpora al suelo)'];
  readonly resuelve: readonly RequirementId[];
  readonly exito: string;

  constructor(private readonly tipo: keyof typeof ABONOS) {
    super();
    const a = ABONOS[tipo];
    const organico = tipo === 'organico';
    this.id = `abonar-${tipo}`;
    this.etiqueta = organico ? 'Abono orgánico' : 'Abono químico';
    this.descripcion = organico
      ? 'Incorpora estiércol o compost: nutre y mejora la estructura del suelo.'
      : 'Aplica fertilizante N-P-K de acción rápida.';
    this.efectos = [
      `N +${a.n} · P +${a.p} · K +${a.k} ppm`,
      ...(a.mo ? [`Materia orgánica +${a.mo} %`] : []),
    ];
    this.resuelve = organico ? ['nitrogeno', 'materia-organica'] : ['nitrogeno'];
    this.exito = organico ? 'Materia orgánica y N-P-K incrementados.' : 'N-P-K incrementados.';
  }

  protected validate(t: TileNode): string | null {
    if (t.canal) return 'La celda tiene un canal de riego.';
    if (t.estado === 'baldio' || t.estado === 'cosechado') return 'Are la celda antes de abonar.';
    return null;
  }

  protected apply(t: TileNode): TileNode {
    const a = ABONOS[this.tipo];
    const s = t.suelo;
    return {
      ...t,
      suelo: {
        ...s,
        n: s.n + a.n,
        p: s.p + a.p,
        k: s.k + a.k,
        materiaOrganica: +(s.materiaOrganica + a.mo).toFixed(1),
      },
    };
  }
}
