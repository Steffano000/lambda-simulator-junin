/**
 * Paso 02 · Herramientas concretas (EP-05.1). Cada una = un Command con sus precondiciones.
 * Las cantidades de abono y riego son parámetros de simulación ajustables (ver constantes).
 */
import type { TileNode } from '../grid';
import { TileCommand, type ActionContext, type Cosecha } from './TileCommand';

/** Aporte por aplicación de abono (ppm de N-P-K, % de materia orgánica). */
export const ABONOS = {
  organico: { n: 10, p: 5, k: 10, mo: 0.5 },
  quimico: { n: 30, p: 15, k: 20, mo: 0 },
} as const;

/** Lámina de riego por aplicación (mm) y profundidad mojada sin cultivo (m). */
export const RIEGO = { laminaMm: 20, profundidadBaseM: 0.3 } as const;

/** Propagación de humedad del canal: radio en celdas y aporte en la celda contigua (%). */
export const CANAL = { radio: 2, aporteContiguo: 30 } as const;

const tieneCultivo = (t: TileNode) => t.vegetacionId !== null;

export class ArarCommand extends TileCommand {
  readonly id = 'arar';
  readonly etiqueta = 'Arar';
  readonly exito = 'Suelo arado y listo para sembrar.';

  protected validate(t: TileNode): string | null {
    if (t.canal) return 'La celda tiene un canal de riego.';
    if (t.estado === 'maduro') return 'Coseche antes de arar.';
    if (tieneCultivo(t)) return 'Remueva el cultivo antes de arar.';
    if (t.estado === 'arado') return 'La celda ya está arada.';
    return null;
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, estado: 'arado' };
  }
}

export class AbonarCommand extends TileCommand {
  readonly id: string;
  readonly etiqueta: string;
  readonly exito: string;

  constructor(private readonly tipo: keyof typeof ABONOS) {
    super();
    this.id = `abonar-${tipo}`;
    this.etiqueta = tipo === 'organico' ? 'Abono orgánico' : 'Abono químico';
    this.exito = tipo === 'organico' ? 'Materia orgánica y N-P-K incrementados.' : 'N-P-K incrementados.';
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

export class RegarCommand extends TileCommand {
  readonly id = 'regar';
  readonly etiqueta = 'Regar';
  readonly exito = 'Riego aplicado.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (t.canal) return 'La celda es un canal de riego.';
    if (t.humedad >= 100) return 'El suelo ya está a capacidad de campo.';
    if (!ctx.soilOf(t.suelo.clase)) return `Clase de suelo sin datos: ${t.suelo.clase}.`;
    return null;
  }

  /**
   * La misma lámina sube más el % en suelos que retienen poca agua (arena) que en los que
   * retienen mucha (arcilla): Δ% = lámina / (agua útil × profundidad) × 100, tope en CC.
   */
  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    const suelo = ctx.soilOf(t.suelo.clase)!;
    const profundidad = ctx.cropOf(t.vegetacionId)?.datos.raiz_m ?? RIEGO.profundidadBaseM;
    const capacidadMm = suelo.agua_util_mm_m * profundidad;
    const delta = (RIEGO.laminaMm / capacidadMm) * 100;
    return { ...t, humedad: Math.min(100, Math.round(t.humedad + delta)) };
  }
}

export class CanalCommand extends TileCommand {
  readonly id = 'canal';
  readonly etiqueta = 'Canal de riego';
  readonly exito = 'Canal instalado; las celdas vecinas reciben humedad.';

  protected validate(t: TileNode): string | null {
    if (t.canal) return 'La celda ya tiene un canal.';
    if (tieneCultivo(t)) return 'El canal requiere una celda libre.';
    return null;
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, canal: true, estado: 'baldio', humedad: 100 };
  }

  /** Humedad residual decreciente con la distancia; la pendiente contraria la cancela (EP-05.2). */
  protected propagate(grid: TileNode[], canal: TileNode): TileNode[] {
    return grid.map((t) => {
      if (t.canal) return t;
      const d = Math.max(Math.abs(t.coords.x - canal.coords.x), Math.abs(t.coords.z - canal.coords.z));
      if (d === 0 || d > CANAL.radio) return t;
      const subida = t.elevacion - canal.elevacion;
      if (subida > 0) return t;
      const aporte = CANAL.aporteContiguo / d;
      return { ...t, humedad: Math.min(100, Math.round(t.humedad + aporte)) };
    });
  }
}

export class SembrarCommand extends TileCommand {
  readonly id = 'sembrar';
  readonly etiqueta = 'Sembrar';
  readonly exito = 'Cultivo sembrado: el ciclo arranca en el día 0.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (!ctx.crop) return 'Seleccione un cultivo para sembrar.';
    if (t.canal) return 'No se puede sembrar sobre un canal.';
    if (tieneCultivo(t)) return 'La celda ya tiene un cultivo.';
    if (t.estado !== 'arado') return 'Are la celda antes de sembrar.';
    const motivos = ctx.crop.motivosBloqueo({ tile: t, mes: ctx.mes, clima: ctx.clima });
    return motivos.length ? motivos.join(' ') : null;
  }

  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    return { ...t, vegetacionId: ctx.crop!.nombre, estado: 'sembrado', diasCultivo: 0 };
  }
}

export class CosecharCommand extends TileCommand {
  readonly id = 'cosechar';
  readonly etiqueta = 'Cosechar';
  readonly exito = 'Cosecha registrada; la celda queda libre.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (!tieneCultivo(t)) return 'No hay cultivo que cosechar.';
    if (t.estado !== 'maduro') {
      const crop = ctx.cropOf(t.vegetacionId);
      const faltan = crop ? crop.inicioFinal - t.diasCultivo : 0;
      return `El cultivo aún no llega a la etapa Final (faltan ${faltan} días).`;
    }
    return null;
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, vegetacionId: null, estado: 'cosechado', diasCultivo: 0 };
  }

  /** TODO(paso-04): aplicar factor de balance hídrico / CHI sobre el rendimiento de referencia. */
  protected harvest(t: TileNode, ctx: ActionContext): Cosecha | undefined {
    const crop = ctx.cropOf(t.vegetacionId);
    if (!crop) return undefined;
    return { tileId: t.id, cultivo: crop.nombre, dia: ctx.dia, kg: +crop.rendimientoRefKgM2.toFixed(2) };
  }
}

export class RemoverCommand extends TileCommand {
  readonly id = 'remover';
  readonly etiqueta = 'Remover cultivo';
  readonly exito = 'Cultivo removido; la celda quedó baldía.';

  protected validate(t: TileNode): string | null {
    return tieneCultivo(t) ? null : 'No hay cultivo que remover.';
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, vegetacionId: null, estado: 'baldio', diasCultivo: 0 };
  }
}
