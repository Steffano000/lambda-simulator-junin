/**
 * Paso 02 · Tratamientos del terreno (EP-05.1): preparan la celda para cumplir los
 * requisitos de siembra. Las cantidades son parámetros de simulación ajustables.
 */
import type { RequirementId } from '../../crops';
import type { TileNode } from '../../grid';
import type { TerrainProfile } from '../../terrain';
import { TileCommand, type ActionContext, type CategoriaAccion } from '../TileCommand';

/** Aporte por aplicación de abono (ppm de N-P-K, % de materia orgánica). */
export const ABONOS = {
  organico: { n: 10, p: 5, k: 10, mo: 0.5 },
  quimico: { n: 30, p: 15, k: 20, mo: 0 },
} as const;

/** Lámina de riego por aplicación (mm) y profundidad mojada sin cultivo (m). */
export const RIEGO = { laminaMm: 20, profundidadBaseM: 0.3 } as const;

/** Enmiendas de pH por aplicación y límites. */
export const ENMIENDAS = { deltaPh: 0.5, phMax: 8.5, phMin: 4.5 } as const;

/** Drenaje: humedad mínima para drenar y reducción por aplicación (%). */
export const DRENAJE = { humedadMin: 70, reduccion: 25 } as const;

/** Propagación de humedad del canal: radio en celdas y aporte en la celda contigua (%). */
export const CANAL = { radio: 2, aporteContiguo: 30 } as const;

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
  readonly descripcion = 'Voltea y descompacta el suelo para recibir la semilla.';
  readonly efectos = ['Estado: Baldío/Cosechado → Arado'];
  readonly prerrequisitos = ['Sin cultivo (coseche o remueva antes)', 'Sin canal de riego'];
  readonly resuelve = ['preparacion'] as const;
  readonly exito = 'Suelo arado y listo para sembrar.';

  protected validate(t: TileNode): string | null {
    if (t.canal) return 'La celda tiene un canal de riego.';
    if (t.estado === 'maduro') return 'Coseche antes de arar.';
    if (t.vegetacionId) return 'Remueva el cultivo antes de arar.';
    if (t.estado === 'arado') return 'La celda ya está arada.';
    return null;
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, estado: 'arado' };
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

export class RegarCommand extends Tratamiento {
  readonly id = 'regar';
  readonly etiqueta = 'Regar';
  readonly descripcion = `Aplica una lámina de ${RIEGO.laminaMm} mm de agua.`;
  readonly efectos = [
    'Humedad sube según la textura: más en arena, menos en arcilla (tope: capacidad de campo)',
  ];
  readonly prerrequisitos = ['Humedad < 100 %', 'Sin canal de riego'];
  readonly resuelve = ['humedad'] as const;
  readonly exito = 'Riego aplicado.';

  protected validate(t: TileNode, ctx: ActionContext): string | null {
    if (t.canal) return 'La celda es un canal de riego.';
    if (t.humedad >= 100) return 'El suelo ya está a capacidad de campo.';
    if (!ctx.soilOf(t.suelo.clase)) return `Clase de suelo sin datos: ${t.suelo.clase}.`;
    return null;
  }

  /** Δ% = lámina / (agua útil × profundidad) × 100, tope en CC. */
  protected apply(t: TileNode, ctx: ActionContext): TileNode {
    const suelo = ctx.soilOf(t.suelo.clase)!;
    const profundidad = ctx.cropOf(t.vegetacionId)?.datos.raiz_m ?? RIEGO.profundidadBaseM;
    const delta = (RIEGO.laminaMm / (suelo.agua_util_mm_m * profundidad)) * 100;
    return { ...t, humedad: Math.min(100, Math.round(t.humedad + delta)) };
  }
}

export class DrenarCommand extends Tratamiento {
  readonly id = 'drenar';
  readonly etiqueta = 'Drenar';
  readonly descripcion = 'Abre zanjas de drenaje para evacuar el exceso de agua.';
  readonly efectos = [`Humedad −${DRENAJE.reduccion} %`, 'Evita el anegamiento de raíces'];
  readonly prerrequisitos = [`Humedad > ${DRENAJE.humedadMin} %`];
  readonly condicionTerreno = 'Solo suelos de textura pesada (arcillosos), que drenan mal';
  readonly exito = 'Drenaje aplicado.';

  aplicaA(terreno: TerrainProfile): boolean {
    return terreno.textura === 'pesada';
  }

  protected validate(t: TileNode): string | null {
    if (t.canal) return 'La celda es un canal de riego.';
    return t.humedad > DRENAJE.humedadMin ? null : `Humedad ${t.humedad} %: no requiere drenaje.`;
  }

  protected apply(t: TileNode): TileNode {
    return { ...t, humedad: Math.max(0, t.humedad - DRENAJE.reduccion) };
  }
}

export class CanalCommand extends Tratamiento {
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
    return { ...t, canal: true, estado: 'baldio', humedad: 100 };
  }

  /** Humedad residual decreciente con la distancia; la pendiente contraria la cancela (EP-05.2). */
  protected propagate(grid: TileNode[], canal: TileNode): TileNode[] {
    return grid.map((t) => {
      if (t.canal) return t;
      const d = Math.max(Math.abs(t.coords.x - canal.coords.x), Math.abs(t.coords.z - canal.coords.z));
      if (d === 0 || d > CANAL.radio || t.elevacion > canal.elevacion) return t;
      return { ...t, humedad: Math.min(100, Math.round(t.humedad + CANAL.aporteContiguo / d)) };
    });
  }
}
