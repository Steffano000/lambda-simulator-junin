/**
 * Balance hídrico de una celda: el MISMO sistema para lluvia y riego (solo cambia la fuente).
 *
 *   agua que llega → absorción (infiltración limitada por intensidad y saturación)
 *                  → lo que no entra queda en surcos/charcos o escurre
 *   cada día        → infiltra el agua de superficie, evapora, transpira (Ks FAO-56)
 *                  → drena el agua gravitacional (sobre CC)
 *
 * Humedad en % del agua útil: 0 = PMP, 100 = CC, > 100 = agua gravitacional hasta saturación.
 */
import { ALMACEN_SUPERFICIE, FACTOR_INFILTRACION_ARADO, type PropiedadesHidricas } from './SoilHydraulics';

export interface EstadoAgua {
  /** % del agua útil (puede superar 100 hasta la saturación) */
  humedad: number;
  /** Agua libre en superficie: surcos o charcos (mm) */
  aguaSuperficie: number;
}

export interface Suelo {
  props: PropiedadesHidricas;
  /** Capacidad hídrica de la capa activa (mm) */
  capacidadMm: number;
  conSurcos: boolean;
}

export interface EntradaAgua {
  estado: EstadoAgua;
  infiltrado: number;
  /** Quedó en surcos o charcos */
  almacenado: number;
  escorrentia: number;
}

export interface PasoDiario {
  estado: EstadoAgua;
  infiltrado: number;
  evaporado: number;
  transpirado: number;
  drenado: number;
}

/** Cultivo presente: coeficiente del día y umbral de agotamiento (FAO-56). */
export interface CultivoAgua {
  kc: number;
  /** Humedad (%) bajo la cual empieza el estrés: (1 − p)·100 */
  umbral: number;
}

/** Kc máximo de evaporación del suelo desnudo mojado (FAO-56: Kc_max − Kcb). */
const KE_MAX = 1.05;

const espacioLibreMm = (e: EstadoAgua, s: Suelo) =>
  Math.max(0, ((s.props.saturacionPct - e.humedad) / 100) * s.capacidadMm);

const tasaInfiltracion = (s: Suelo) => s.props.absorcionMmH * (s.conSurcos ? FACTOR_INFILTRACION_ARADO : 1);

/** Coeficiente de estrés hídrico Ks (FAO-56): 1 sin estrés, baja lineal bajo el umbral. */
export const ks = (humedad: number, umbral: number): number =>
  humedad >= umbral ? 1 : Math.max(0, humedad / umbral);

export class WaterBalance {
  /**
   * Entrada de agua (lluvia o riego) de `mm` repartidos en `horas`.
   * Absorbe lo que la infiltración y el espacio del suelo permiten; el resto se guarda en
   * superficie (surcos o microdepresiones) y lo que desborda escurre.
   */
  static aplicar(estado: EstadoAgua, mm: number, horas: number, s: Suelo): EntradaAgua {
    const disponible = estado.aguaSuperficie + mm;
    const capacidadEvento = tasaInfiltracion(s) * Math.max(horas, 0.1);
    const infiltrado = Math.min(disponible, capacidadEvento, espacioLibreMm(estado, s));
    const sobrante = disponible - infiltrado;
    const tope = s.conSurcos ? ALMACEN_SUPERFICIE.surcos : ALMACEN_SUPERFICIE.plano;
    const aguaSuperficie = Math.min(sobrante, tope);

    return {
      estado: { humedad: estado.humedad + (infiltrado / s.capacidadMm) * 100, aguaSuperficie },
      infiltrado,
      almacenado: aguaSuperficie,
      escorrentia: sobrante - aguaSuperficie,
    };
  }

  /** Un día sin entrada de agua: infiltración de superficie, evaporación, ET y drenaje. */
  static dia(estado: EstadoAgua, et0: number, s: Suelo, cultivo?: CultivoAgua): PasoDiario {
    let { humedad, aguaSuperficie } = estado;

    // 1. El agua de surcos/charcos se incorpora según la absorción y el espacio libre
    const infiltrado = Math.min(
      aguaSuperficie,
      tasaInfiltracion(s) * 24,
      espacioLibreMm({ humedad, aguaSuperficie }, s),
    );
    aguaSuperficie -= infiltrado;
    humedad += (infiltrado / s.capacidadMm) * 100;

    // 2. Evaporación: primero el agua libre, luego el suelo
    const evapLibre = Math.min(aguaSuperficie, et0);
    aguaSuperficie -= evapLibre;
    const demanda = et0 - evapLibre;

    let transpirado = 0;
    let evapSuelo = 0;
    if (cultivo) {
      // ETa = Ks · Kc · ET0: el suelo seco transpira menos
      transpirado = ks(humedad, cultivo.umbral) * cultivo.kc * demanda;
    } else {
      // Suelo desnudo en dos etapas (FAO-56): a tasa plena hasta agotar REW, luego decrece
      const agotado = Math.max(0, (1 - humedad / 100) * s.props.tewMm);
      const kr =
        agotado <= s.props.rewMm
          ? 1
          : Math.max(0, (s.props.tewMm - agotado) / (s.props.tewMm - s.props.rewMm));
      evapSuelo = kr * KE_MAX * demanda;
    }
    const salida = Math.min(transpirado + evapSuelo, (humedad / 100) * s.capacidadMm);
    humedad -= (salida / s.capacidadMm) * 100;

    // 3. Drenaje del agua gravitacional (sobre CC)
    let drenado = 0;
    if (humedad > 100) {
      const exceso = humedad - 100;
      drenado = ((exceso * s.props.drenajeDia) / 100) * s.capacidadMm;
      humedad -= exceso * s.props.drenajeDia;
    }

    return {
      estado: { humedad: Math.max(0, humedad), aguaSuperficie: Math.max(0, aguaSuperficie) },
      infiltrado,
      evaporado: evapLibre + (cultivo ? 0 : Math.min(evapSuelo, salida)),
      transpirado: cultivo ? salida : 0,
      drenado,
    };
  }
}
