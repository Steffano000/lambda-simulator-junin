/**
 * Riego y manejo del agua. El riego (acción del usuario) entra por el MISMO balance hídrico
 * que la lluvia (evento del clima): absorción → retención → surcos/escorrentía → drenaje.
 */
import type { TileNode } from '../../grid';
import { ALMACEN_SUPERFICIE, aplicarAgua, sueloDeCelda, tieneSurcos } from '../../hydrology';
import type { TerrainProfile } from '../../terrain';
import { TileCommand, type ActionContext, type CategoriaAccion } from '../TileCommand';

/** Aspersión: lámina por aplicación (mm) repartida en `horas` (≈ 10 mm/h). */
export const RIEGO = { laminaMm: 20, horas: 2 } as const;

/** Inundación: llena los surcos; el agua se infiltra durante `horas` y el resto queda en ellos. */
export const INUNDACION = { horas: 3 } as const;

/** Drenaje: humedad mínima para drenar y reducción por aplicación (%). */
export const DRENAJE = { humedadMin: 70, reduccion: 25 } as const;

/** Propagación de humedad del canal: radio en celdas y aporte en la celda contigua (%). */
export const CANAL = { radio: 2, aporteContiguo: 30 } as const;

abstract class ManejoAgua extends TileCommand {
  readonly categoria: CategoriaAccion = 'tratamiento';

  /** Suelo hídrico de la celda; null si la clase de suelo no tiene datos. */
  protected suelo(t: TileNode, ctx: ActionContext) {
    const props = ctx.hidraulica(t.suelo.clase);
    return props ? sueloDeCelda(t, props, ctx.cropOf(t.vegetacionId)?.datos.raiz_m) : null;
  }
}

export class RegarCommand extends ManejoAgua {
  readonly id = 'regar';
  readonly etiqueta = 'Regar (aspersión)';
  readonly descripcion = `Lámina de ${RIEGO.laminaMm} mm en ${RIEGO.horas} h, repartida sobre toda la celda.`;
  readonly efectos = [
    'El agua entra según la absorción del suelo',
    'Más % de hidratación en arena (retiene poco), menos en arcilla',
    'Lo que no se absorbe queda en superficie o escurre',
  ];
  readonly prerrequisitos = ['Humedad bajo capacidad de campo (< 100 %)', 'Sin canal de riego'];
  readonly resuelve = ['humedad'] as const;
  readonly exito = 'Riego por aspersión aplicado.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (t.canal) return 'La celda es un canal de riego.';
    if (t.humedad >= 100) return 'El suelo ya está a capacidad de campo.';
    return this.suelo(t, ctx) ? null : `Clase de suelo sin datos: ${t.suelo.clase}.`;
  }

  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    return aplicarAgua(t, RIEGO.laminaMm, RIEGO.horas, this.suelo(t, ctx)!).tile;
  }
}

export class InundarCommand extends ManejoAgua {
  readonly id = 'inundar';
  readonly etiqueta = 'Riego por inundación';
  readonly descripcion = 'Llena los surcos de agua; el suelo la absorbe desde ellos.';
  readonly efectos = [
    `Surcos llenos: hasta ${ALMACEN_SUPERFICIE.surcos} mm de agua libre`,
    `Durante ${INUNDACION.horas} h se infiltra según la absorción del suelo`,
    'El resto queda en los surcos y se incorpora al avanzar los días',
    'En suelos que drenan mal puede saturar y encharcar',
  ];
  readonly prerrequisitos = ['Celda arada (con surcos)', 'Surcos sin llenar'];
  readonly condicionTerreno = 'Requiere surcos: primero hay que arar';
  readonly resuelve = ['humedad'] as const;
  readonly exito = 'Surcos inundados.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (t.canal) return 'La celda es un canal de riego.';
    if (!tieneSurcos(t)) return 'Sin surcos: are la celda para poder inundarla.';
    if (t.aguaSuperficie >= ALMACEN_SUPERFICIE.surcos - 1) return 'Los surcos ya están llenos.';
    return this.suelo(t, ctx) ? null : `Clase de suelo sin datos: ${t.suelo.clase}.`;
  }

  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    const lamina = ALMACEN_SUPERFICIE.surcos - t.aguaSuperficie;
    return aplicarAgua(t, lamina, INUNDACION.horas, this.suelo(t, ctx)!).tile;
  }
}

export class DrenarCommand extends ManejoAgua {
  readonly id = 'drenar';
  readonly etiqueta = 'Drenar';
  readonly descripcion = 'Abre zanjas de drenaje para evacuar el exceso de agua.';
  readonly efectos = [
    'Retira el agua libre de surcos y charcos',
    `Elimina el agua gravitacional y baja la humedad ${DRENAJE.reduccion} %`,
    'Evita el anegamiento de raíces',
  ];
  readonly prerrequisitos = [`Humedad > ${DRENAJE.humedadMin} % o agua en superficie`];
  readonly condicionTerreno = 'Solo suelos de textura pesada (arcillosos), que drenan mal';
  readonly exito = 'Drenaje aplicado.';

  aplicaA(terreno: TerrainProfile): boolean {
    return terreno.textura === 'pesada';
  }

  protected validate(t: TileNode): string | null {
    if (t.canal) return 'La celda es un canal de riego.';
    return t.humedad > DRENAJE.humedadMin || t.aguaSuperficie > 0.5
      ? null
      : `Humedad ${Math.round(t.humedad)} %: no requiere drenaje.`;
  }

  protected apply(t: TileNode): TileNode {
    const humedad = Math.max(0, Math.min(t.humedad, 100) - DRENAJE.reduccion);
    return { ...t, humedad, aguaSuperficie: 0, diasEncharcado: 0 };
  }
}

export class CanalCommand extends ManejoAgua {
  readonly id = 'canal';
  readonly etiqueta = 'Canal de riego';
  readonly descripcion = 'Convierte la celda en un canal que humedece a sus vecinas.';
  readonly efectos = [
    'La celda deja de ser cultivable',
    `Vecinas en radio ${CANAL.radio}: humedad +${CANAL.aporteContiguo} % ÷ distancia`,
    'No sube hacia celdas más altas (pendiente)',
  ];
  readonly prerrequisitos = ['Celda libre (sin cultivo)'];
  readonly resuelve = ['humedad'] as const;
  readonly exito = 'Canal instalado; las celdas vecinas reciben humedad.';

  protected validate(t: TileNode): string | null {
    if (t.canal) return 'La celda ya tiene un canal.';
    if (t.vegetacionId) return 'El canal requiere una celda libre.';
    return null;
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, canal: true, estado: 'baldio', surcos: null, humedad: 100, aguaSuperficie: 0 };
  }

  /** Humedad residual decreciente con la distancia; la pendiente contraria la cancela (EP-05.2). */
  protected propagate(grid: TileNode[], canal: TileNode): TileNode[] {
    return grid.map((t) => {
      if (t.canal) return t;
      const d = Math.max(Math.abs(t.coords.x - canal.coords.x), Math.abs(t.coords.z - canal.coords.z));
      if (d === 0 || d > CANAL.radio || t.elevacion > canal.elevacion) return t;
      return {
        ...t,
        humedad: Math.min(Math.max(t.humedad, 100), Math.round(t.humedad + CANAL.aporteContiguo / d)),
      };
    });
  }
}
