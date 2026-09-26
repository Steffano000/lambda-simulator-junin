/** Paso 02/04 · Acciones de plantación: sembrar, cosechar y remover. */
import { EXTRACCION_N, RECUPERACION_DESCANSO, demandaN } from '../../crops';
import type { TileNode } from '../../grid';
import { TileCommand, type ActionContext, type CategoriaAccion, type Cosecha } from '../TileCommand';

abstract class AccionPlantacion extends TileCommand {
  readonly categoria: CategoriaAccion = 'plantacion';
}

export class SembrarCommand extends AccionPlantacion {
  readonly id = 'sembrar';
  readonly etiqueta = 'Sembrar';
  readonly descripcion = 'Planta el cultivo seleccionado en la celda.';
  readonly efectos = ['Estado: Arado → Sembrado', 'El ciclo arranca en el día 0'];
  readonly prerrequisitos = ['Todos los requisitos del cultivo', 'Mes de siembra y clima aptos'];
  readonly exito = 'Cultivo sembrado: el ciclo arranca en el día 0.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (!ctx.crop) return 'Seleccione un cultivo para sembrar.';
    const motivos = ctx.crop.motivosBloqueo({ tile: t, mes: ctx.mes, clima: ctx.clima });
    return motivos.length ? motivos.join(' ') : null;
  }

  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    return { ...t, vegetacionId: ctx.crop!.nombre, estado: 'sembrado', diasCultivo: 0, salud: 100 };
  }
}

export class CosecharCommand extends AccionPlantacion {
  readonly id = 'cosechar';
  readonly etiqueta = 'Cosechar';
  readonly descripcion = 'Recoge el cultivo que llegó a la etapa Final.';
  readonly efectos = [
    'Registra kg = rendimiento de referencia × salud',
    'Estado: Maduro → Cosechado (se deshacen los surcos)',
    'La cosecha se lleva nitrógeno del suelo (las leguminosas lo aportan)',
  ];
  readonly prerrequisitos = ['Cultivo en etapa Final (maduro)', 'Planta viva'];
  readonly exito = 'Cosecha registrada; la celda queda libre.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (!t.vegetacionId) return 'No hay cultivo que cosechar.';
    if (t.salud <= 0) return 'El cultivo murió: remuévalo.';
    if (t.estado !== 'maduro') {
      const crop = ctx.cropOf(t.vegetacionId);
      const faltan = crop ? crop.inicioFinal - t.diasCultivo : 0;
      return `Aún no llega a la etapa Final (faltan ${faltan} días).`;
    }
    return null;
  }

  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    const crop = ctx.cropOf(t.vegetacionId);
    const extraido = crop ? EXTRACCION_N[demandaN(crop.datos)] : 0;
    return {
      ...t,
      vegetacionId: null,
      estado: 'cosechado',
      surcos: null,
      diasCultivo: 0,
      salud: 100,
      suelo: { ...t.suelo, n: Math.max(0, Math.round(t.suelo.n - extraido)) },
    };
  }

  protected harvest(t: TileNode, ctx: ActionContext): Cosecha | undefined {
    const crop = ctx.cropOf(t.vegetacionId);
    if (!crop) return undefined;
    const kg = crop.rendimientoRefKgM2 * (t.salud / 100);
    return {
      tileId: t.id,
      cultivo: crop.nombre,
      dia: ctx.dia,
      salud: Math.round(t.salud),
      kg: +kg.toFixed(2),
    };
  }
}

export class RemoverCommand extends AccionPlantacion {
  readonly id = 'remover';
  readonly etiqueta = 'Remover cultivo';
  readonly descripcion = 'Retira las plantas (vivas o muertas) sin cosechar.';
  readonly efectos = ['La celda queda baldía y sin surcos: hay que volver a arar'];
  readonly prerrequisitos = ['Celda con cultivo'];
  readonly exito = 'Cultivo removido; la celda quedó baldía.';

  protected validate(t: TileNode): string | null {
    return t.vegetacionId ? null : 'No hay cultivo que remover.';
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, vegetacionId: null, estado: 'baldio', surcos: null, diasCultivo: 0, salud: 100 };
  }
}

/** Barbecho: deja el suelo cosechado en descanso para que recupere nitrógeno y materia orgánica. */
export class DescansarCommand extends AccionPlantacion {
  readonly id = 'descansar';
  readonly etiqueta = 'Dejar en descanso';
  readonly descripcion = 'Deja el suelo sin cultivar para que recupere nutrientes (barbecho).';
  readonly efectos = [
    `N +${RECUPERACION_DESCANSO.nPorDia} ppm y M.O. +${RECUPERACION_DESCANSO.moPorDia} % por día`,
    'No se puede arar hasta terminar el descanso',
  ];
  readonly prerrequisitos = ['Celda sin cultivo', 'Días de descanso definidos'];
  readonly exito = 'El suelo quedó en descanso.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (t.canal) return 'La celda es un canal de riego.';
    if (t.vegetacionId) return 'Coseche o remueva el cultivo antes de dejar descansar el suelo.';
    if (!ctx.diasDescanso || ctx.diasDescanso <= 0) return 'Indique cuántos días debe descansar el suelo.';
    return null;
  }

  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    return { ...t, descansoHasta: ctx.dia + ctx.diasDescanso!, surcos: null };
  }
}
