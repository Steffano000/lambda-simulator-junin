/**
 * Controlador del modo Junín: carga los JSON locales, maneja el dibujo de la parcela,
 * arma la grilla de chunks (local o servidor), la rotación y el paso al simulador 3D.
 */
import { container } from '@/app/container';
import { SiembraRepository } from '@/data';
import { JuninRepository } from '@/data/junin';
import { casasEnVivo } from '@/data/junin/osm';
import { chunksDelServidor, servidorDisponible } from '@/data/junin/servidor';
import type { EscenarioId, Parcela } from '@/data/junin/types';
import {
  aClimaMes,
  areaHa,
  CAPAS,
  centroide,
  construirChunks,
  CULTIVO_SIMULADOR,
  cuadrado,
  enGeojson,
  indexarPoligonos,
  prepararChunks,
  SUPUESTOS_SIMULADOR,
  type PoligonoIndexado,
  nombreEscenario,
  parcelaParaSimulador,
  pisoEcologico,
  puntoMasCercano,
  evaluarSiembra,
  rendimiento,
  rendimientoPorChunk,
  resumirParcela,
  resumirResolucion,
  tamanoChunk,
  type Anillo,
  type CapaDato,
  type ResultadoRendimiento,
} from '@/domain/junin';
import { SoilMix, TerrainProfile } from '@/domain/terrain';
import {
  useJuninStore,
  type BaseNasa,
  type CapaChunk,
  type JuninState,
  type Modo,
  type OverlayNasa,
} from '@/store/juninStore';
import { useSimStore } from '@/store/useSimStore';

const set = (p: Partial<JuninState>) => useJuninStore.setState(p);
const get = () => useJuninStore.getState();

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export class JuninController {
  private iniciado = false;

  /** Carga el núcleo, la grilla de 1 km, los límites y las 10 parcelas de 30 m */
  async iniciar(): Promise<void> {
    if (this.iniciado) return;
    this.iniciado = true;
    try {
      set({ cargando: 'Cargando datos de Junín…', error: null });
      const [nucleo, grilla, region, provincias, protegidas] = await Promise.all([
        JuninRepository.nucleo(),
        JuninRepository.grillaJunin(),
        JuninRepository.limiteRegion(),
        JuninRepository.limitesProvincias(),
        JuninRepository.areasProtegidas(),
      ]);
      set({ nucleo, grilla, region, provincias, protegidas, cargando: null });
      const parcelas = await Promise.all(
        nucleo.puntos.map((p) => JuninRepository.parcela(p.id).catch(() => null)),
      );
      set({ parcelas: parcelas.filter((p): p is Parcela => p != null) });
      set({ servidor: await servidorDisponible() });
    } catch (e) {
      this.iniciado = false;
      set({ cargando: null, error: `No se pudieron cargar los datos: ${(e as Error).message}` });
    }
  }

  setModo(modo: Modo): void {
    set({ modo });
  }

  // ----- Geovisor -----
  setFecha(fecha: string): void {
    set({ fecha, avisoTeselas: null });
  }
  moverFecha(dias: number): void {
    const d = new Date(`${get().fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    const hoy = new Date().toISOString().slice(0, 10);
    const f = d.toISOString().slice(0, 10);
    this.setFecha(f > hoy ? hoy : f);
  }
  setBase(base: BaseNasa): void {
    set({ base, avisoTeselas: null });
  }
  toggleOverlay(o: OverlayNasa): void {
    set({ overlays: { ...get().overlays, [o]: !get().overlays[o] }, avisoTeselas: null });
  }
  toggleProtegidas(): void {
    set({ verProtegidas: !get().verProtegidas });
  }
  avisarTeselas(texto: string | null): void {
    if (get().avisoTeselas !== texto) set({ avisoTeselas: texto });
  }

  // ----- Dibujo de la parcela (paso 2) -----
  empezarDibujo(): void {
    set({ dibujando: true, borrador: [] });
  }
  agregarVertice(lat: number, lon: number): void {
    if (!get().dibujando) return;
    set({ borrador: [...get().borrador, [lon, lat]] });
  }
  deshacerVertice(): void {
    set({ borrador: get().borrador.slice(0, -1) });
  }
  cancelarDibujo(): void {
    set({ dibujando: false, borrador: [] });
  }
  async terminarDibujo(): Promise<void> {
    const b = get().borrador;
    if (b.length < 3) return set({ error: 'La parcela necesita al menos 3 vértices.' });
    set({ dibujando: false, borrador: [] });
    await this.procesar(b);
  }
  async usarEjemplo(punto: string, lado_m = 300): Promise<void> {
    const p = get().nucleo?.puntos.find((x) => x.id === punto);
    if (p) await this.procesar(cuadrado(p.lat, p.lon, lado_m));
  }
  borrarParcela(): void {
    set({
      anillo: null,
      chunks: null,
      resumen: null,
      ubicacion: null,
      casas: null,
      resolucion: null,
      celdaElegida: null,
      area_ha: 0,
      plan: [],
      cultivo: null,
      anterior: null,
      campana: 0,
    });
  }

  private indiceProtegidas: PoligonoIndexado[] | null = null;
  private protegidasIndexadas(): PoligonoIndexado[] {
    const fc = get().protegidas;
    if (!fc) return [];
    this.indiceProtegidas ??= indexarPoligonos(fc, (p) =>
      [p.DESIG, p.NAME ?? p.ORIG_NAME].filter(Boolean).join(' '),
    );
    return this.indiceProtegidas;
  }

  /** Cambia el tamaño de chunk (null = automático) y rearma la grilla de la misma parcela */
  async setCelda(celda: number | null): Promise<void> {
    const a = get().anillo;
    if (a) await this.procesar(a, celda);
  }
  setCapaFidelidad(capaFidelidad: CapaDato | 'peor'): void {
    set({ capaFidelidad, capaChunk: 'fidelidad' });
  }

  /**
   * Pasos 3 a 6: área, ubicación, uso de suelo (incluye casas y áreas protegidas) y chunks.
   * `celdaElegida`: tamaño de chunk elegido en el paso 3; null = automático para este equipo.
   */
  async procesar(anillo: Anillo, celdaElegida: number | null = null): Promise<void> {
    const { nucleo, grilla, parcelas, region, limite } = get();
    if (!nucleo || !grilla) return;
    const celda = celdaElegida ?? tamanoChunk(anillo, limite.maxLado);
    set({
      cargando: 'Analizando la parcela…',
      error: null,
      anillo,
      celdaElegida,
      plan: [],
      anterior: null,
      campana: 0,
    });
    const area_ha = areaHa(anillo);
    const c = centroide(anillo);
    const fuera = region ? !enGeojson(c.lat, c.lon, region) : false;
    const punto = puntoMasCercano(c.lat, c.lon, nucleo.sim);
    const pp = nucleo.sim.puntos[punto];

    let chunks = null;
    if (get().servidor) {
      try {
        chunks = await chunksDelServidor(anillo, celda);
      } catch {
        set({ servidor: false });
      }
    }
    chunks ??= construirChunks(anillo, { grilla, parcelas, reglas: nucleo.reglas }, celda);
    // Casas EN VIVO (OpenStreetMap). Si falla, se avisa en el panel; no se asume que no hay casas.
    set({ cargando: 'Buscando casas en OpenStreetMap…', casas: null });
    const casas = await casasEnVivo(chunks.bbox);
    const distanciaClimaM = distanciaKm(c.lat, c.lon, pp.lat, pp.lon) * 1000;
    chunks = prepararChunks(chunks, anillo, {
      reglas: nucleo.reglas,
      distanciaClimaM,
      protegidas: this.protegidasIndexadas(),
      casas: casas.casas,
    });
    const resumen = resumirParcela(chunks, nucleo.reglas);
    const resolucion = resumirResolucion(chunks, distanciaClimaM);
    const elev = resumen.elevacion_media_m;
    const capaPrevia = get().capaChunk;
    set({
      cargando: null,
      area_ha,
      chunks,
      resumen,
      resolucion,
      ubicacion: {
        punto,
        distancia_km: distanciaKm(c.lat, c.lon, pp.lat, pp.lon),
        provincia: pp.provincia,
        piso: elev == null ? null : pisoEcologico(elev, nucleo.catalogo.pisos_ecologicos),
        fuera_de_junin: fuera,
        area_protegida: resumen.areas_protegidas.length ? resumen.areas_protegidas.join(', ') : null,
      },
      casas: {
        estado: casas.estado,
        n: casas.casas.length,
        mensaje: casas.mensaje,
        fuente: casas.fuente,
        consultado: casas.consultado,
        contornos: casas.casas,
      },
      // al cambiar solo el tamaño de chunk se mantiene la capa que se estaba viendo
      capaChunk:
        celdaElegida != null && capaPrevia !== 'rendimiento'
          ? capaPrevia
          : resumen.puede_sembrar
            ? 'textura'
            : 'regla',
    });
  }

  // ----- Simulador (pasos 7 a 12) -----
  setCapaChunk(capaChunk: CapaChunk): void {
    set({ capaChunk });
  }
  setEscenario(escenario: EscenarioId): void {
    set({ escenario });
  }
  setCultivo(cultivo: string | null): void {
    set({ cultivo });
  }
  setAnterior(anterior: string | null): void {
    set({ anterior });
  }
  setCampana(campana: number): void {
    set({ campana });
  }
  setUltimoResultado(r: ResultadoRendimiento | null): void {
    if (get().ultimoResultado !== r) set({ ultimoResultado: r });
  }

  /** Paso 12: guarda la campaña y pasa a la siguiente con este cultivo como anterior */
  agregarARotacion(
    r: ResultadoRendimiento,
    nombre: string,
    produccion_t: number,
    rend_parcela: number,
  ): void {
    const plan = [
      ...get().plan.filter((p) => p.campana !== r.campana),
      {
        campana: r.campana,
        cultivo: r.cultivo,
        nombre,
        anterior: r.anterior,
        rend_t_ha: rend_parcela,
        produccion_t,
        motor: r.motor_etiqueta,
      },
    ].sort((a, b) => a.campana - b.campana);
    const siguiente = Math.min(1, r.campana + 1);
    set({
      plan,
      anterior: r.cultivo,
      campana: siguiente,
      cultivo: siguiente === r.campana ? r.cultivo : null,
    });
  }
  reiniciarRotacion(): void {
    set({ plan: [], anterior: null, campana: 0 });
  }

  /** Abre la parcela real en el simulador 3D con el escenario y el cultivo elegidos */
  abrirEn3D(): string | null {
    const { chunks, nucleo, ubicacion, escenario, campana, cultivo, resolucion } = get();
    if (!chunks || !nucleo || !ubicacion) return 'Primero dibuja una parcela.';
    // Rendimiento del motor de Junín por chunk para cada cultivo que existe en el 3D:
    // la cosecha del 3D = este número × salud de la celda × área real de la celda
    const pp = nucleo.sim.puntos[ubicacion.punto];
    const rendJunin: Record<string, (number | null)[]> = {};
    const noAptos: string[] = [];
    const { resumen } = get();
    for (const [id, nombre3D] of Object.entries(CULTIVO_SIMULADOR)) {
      const r = rendimiento(ubicacion.punto, escenario, id, get().anterior, nucleo, campana);
      if (!r) continue;
      // Condiciones de plantación (Fase 3): si no es apto, su cosecha en 3D es 0
      const ev = resumen
        ? evaluarSiembra({
            cultivo: id,
            escenario,
            campana,
            anterior: get().anterior,
            punto: ubicacion.punto,
            distancia_km: ubicacion.distancia_km,
            chunks,
            resumen,
            nucleo,
            siembra: SiembraRepository.all(),
          })
        : null;
      if (ev?.estado === 'no_apta') noAptos.push(nombre3D);
      const factor = ev?.estado === 'no_apta' ? 0 : (ev?.factor_helada ?? 1);
      rendJunin[nombre3D] = rendimientoPorChunk(
        chunks,
        r.rend_t_ha * factor,
        nucleo.catalogo.cultivos[id]?.ecocrop,
        pp?.suelo.ph ?? null,
      ).porChunk;
    }
    const p = parcelaParaSimulador(chunks, container.terrains.clases(), rendJunin);
    const terreno = new TerrainProfile(p.dominante, p.reaccion, p.config, SoilMix.de(p.mezcla), 'manchas');

    // Clima: los 12 meses de la campaña del escenario elegido, como escenario de la app
    const nombre = nombreEscenario(nucleo.sim, ubicacion.punto, escenario, campana);
    const meses = aClimaMes(nucleo.sim.puntos[ubicacion.punto].escenarios[escenario].meses, campana * 12);
    let escenarioApp = useSimStore.getState().escenario;
    try {
      if (!container.scenarios.existe(nombre)) container.scenarios.custom(nombre, meses);
      escenarioApp = nombre;
    } catch {
      /* si el clima no pasa la validación de la app, se mantiene el escenario actual */
    }
    const camp = cultivo
      ? nucleo.sim.puntos[ubicacion.punto].escenarios[escenario].cultivos[cultivo]?.[campana]
      : null;
    const mesInicio = camp ? Number(camp.siembra.slice(5, 7)) : 10;

    useSimStore.setState({
      opcionesTerreno: { mezcla: p.mezcla, reaccion: p.reaccion, tamano: 'parcela' },
      terreno,
      config: p.config,
      tiles: p.tiles,
      fase: 'tratamiento',
      seleccion: [],
      herramienta: null,
      dia: 0,
      plantaciones: [],
      bitacora: [],
      reportes: [],
      reporteAbierto: null,
      cosechas: [],
      correccion: null,
      ultimoAvance: null,
      escenario: escenarioApp,
      mesInicio,
      cultivo: cultivo ? (CULTIVO_SIMULADOR[cultivo] ?? null) : null,
      mensaje: {
        tipo: 'ok',
        texto: `Parcela real de Junín cargada: chunks de ${chunks.celda_m} m (relieve ×3). Solo se dibuja tu polígono; ${p.celdasBloqueadas} celdas bloqueadas o sin dato quedan como losas planas y no aceptan acciones.`,
        detalle: [
          `Cada celda mide ${chunks.celda_m} × ${chunks.celda_m} m (${chunks.celda_m ** 2} m²; las del borde, solo la parte dentro del polígono). La cosecha = rendimiento del motor de Junín de esa celda (el mismo del panel) × su salud × su área; insumos y agua también van por m² reales.`,
          ...(noAptos.length
            ? [
                `No aptos en esta parcela (condiciones de plantación): ${noAptos.join(', ')}. Si los siembras, su cosecha será 0.`,
              ]
            : []),
          ...(cultivo && !CULTIVO_SIMULADOR[cultivo]
            ? [
                `${nucleo.catalogo.cultivos[cultivo]?.nombre ?? cultivo} no se simula en 3D: aquí puedes sembrar ${Object.values(CULTIVO_SIMULADOR).join(', ').toLowerCase()}, cada uno con su rendimiento del motor de Junín para esta parcela.`,
              ]
            : []),
          `Supuestos del simulador (no son datos medidos): P ${SUPUESTOS_SIMULADOR.p}, K ${SUPUESTOS_SIMULADOR.k} y humedad inicial ${SUPUESTOS_SIMULADOR.humedad} %.`,
          ...(resolucion
            ? [
                `Resolución efectiva ${resolucion.efectiva_m} m (${CAPAS[resolucion.capa_efectiva].nombre.toLowerCase()}). La capa «Fidelidad» pinta la más baja de uso de suelo, relieve y suelo: ámbar = la celda hereda el dato de un píxel más grande.`,
              ]
            : []),
          ...(p.recorte ? ['La parcela era más grande que 100×100 chunks: se recortó.'] : []),
        ],
      },
    });
    set({ modo: 'simulador' });
    return null;
  }
}

export const juninController = new JuninController();
