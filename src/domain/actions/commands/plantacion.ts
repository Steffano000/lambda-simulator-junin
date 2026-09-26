/** Paso 02/04 · Acciones de plantación: sembrar, cosechar y remover. */
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
  readonly efectos = ['Registra kg = rendimiento de referencia × salud', 'Estado: Maduro → Cosechado'];
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

  protected apply(t: TileNode): TileNode {
    return { ...t, vegetacionId: null, estado: 'cosechado', diasCultivo: 0, salud: 100 };
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
  readonly efectos = ['La celda queda baldía: hay que volver a arar'];
  readonly prerrequisitos = ['Celda con cultivo'];
  readonly exito = 'Cultivo removido; la celda quedó baldía.';

  protected validate(t: TileNode): string | null {
    return t.vegetacionId ? null : 'No hay cultivo que remover.';
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, vegetacionId: null, estado: 'baldio', diasCultivo: 0, salud: 100 };
  }
}
