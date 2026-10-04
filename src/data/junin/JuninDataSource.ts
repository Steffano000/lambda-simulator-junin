/**
 * Repositorio de los datos de Junín (public/data/junin). A diferencia de data/*.json,
 * estos archivos NO se empaquetan con la app: se piden con fetch cuando hacen falta
 * y quedan en caché. El lector se inyecta para poder usar el sistema de archivos en tests.
 */
import type {
  AptitudPunto,
  AquaCropResumen,
  CatalogoCultivos,
  Fenologia,
  GrillaCapas,
  GrillaMensual,
  Manifiesto,
  NucleoJunin,
  Parcela,
  PuntoDatos,
  ReglasUsoSuelo,
  SerieDiaria,
  SimuladorEscenarios,
} from './types';
import { medir } from '../registro';

/** Lee un JSON por su ruta relativa a public/data/junin */
export type LectorJson = (ruta: string) => Promise<unknown>;

/** Lector por fetch; cada pedido queda en el registro de consultas (Fase 6) */
export const lectorFetch =
  (base: string): LectorJson =>
  (ruta) =>
    medir('datos_locales', ruta, async () => {
      // `no-cache`: «Actualizar datos» revalida con el servidor en vez de usar la caché HTTP
      const r = await fetch(`${base.replace(/\/$/, '')}/${ruta}`, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
      return r.json();
    });

export class JuninDataSource {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(private readonly lector: LectorJson) {}

  private leer<T>(ruta: string): Promise<T> {
    let p = this.cache.get(ruta);
    if (!p) {
      p = this.lector(ruta);
      // si falla, que el próximo intento vuelva a pedirlo
      p.catch(() => this.cache.delete(ruta));
      this.cache.set(ruta, p);
    }
    return p as Promise<T>;
  }

  /** «Actualizar datos»: olvida lo cargado en esta sesión; el próximo pedido va al servidor */
  limpiar(): void {
    this.cache.clear();
  }

  manifiesto = () => this.leer<Manifiesto>('manifest.json');

  /** Bitácora de descargas del pipeline (fecha de cada archivo de origen) */
  registroDescargas = () =>
    this.leer<{ fecha_hora: string; script: number | string; archivo: string; estado: string }[]>(
      'meta/registro_descargas.json',
    );

  /** Núcleo del simulador: escenarios, cultivos, fenología, AquaCrop, reglas, puntos y aptitud */
  async nucleo(): Promise<NucleoJunin> {
    const [sim, catalogo, fenologia, aquacrop, reglas, puntos, aptitud] = await Promise.all([
      this.leer<SimuladorEscenarios>('app/simulador_escenarios.json'),
      this.leer<CatalogoCultivos>('app/catalogo_cultivos_junin.json'),
      this.leer<Fenologia>('app/fenologia_cultivos.json'),
      this.leer<AquaCropResumen>('app/aquacrop_resumen.json'),
      this.leer<ReglasUsoSuelo>('app/reglas_uso_suelo.json'),
      this.leer<{ puntos: PuntoDatos[] }>('app/puntos.json'),
      this.leer<AptitudPunto[]>('cultivos/aptitud_puntos.json'),
    ]);
    return { sim, catalogo, fenologia, aquacrop, reglas, puntos: puntos.puntos, aptitud };
  }

  /** Terreno, suelo, cobertura y NDVI de todo Junín a ~1 km (4.4 MB) */
  grillaJunin = () => this.leer<GrillaCapas>('grillas/junin_1km.json');
  ndviClimatologia = () => this.leer<GrillaCapas>('grillas/ndvi_climatologia_2km.json');
  sueloPorProfundidad = () => this.leer<GrillaCapas>('grillas/suelo_profundidades_2km.json');

  /** 40 × 40 celdas de 30 m alrededor de un punto con datos */
  parcela = (punto: string) => this.leer<Parcela>(`parcelas/${punto}.json`);

  /** Serie diaria 1950-2026 de un punto (~2.5 MB) */
  serieDiaria = (punto: string) => this.leer<SerieDiaria>(`clima/diario/${punto}.json`);

  humedadSmapMensual = () => this.leer<GrillaMensual>('humedad/smap_mensual.json');
  lluviaPiscoMensual = () => this.leer<GrillaMensual>('pisco/piscop_mensual_1981_2025.json');
  lluviaEra5Mensual = () => this.leer<GrillaMensual>('clima/era5land_lluvia_mensual_1991_2026.json');
  climatologiaEra5 = () => this.leer<unknown>('clima/era5land_climatologia_1991_2020.json');

  limitesProvincias = () => this.leer<GeoJSON>('limites/junin_provincias.geojson');
  limiteRegion = () => this.leer<GeoJSON>('limites/junin_region.geojson');
  areasProtegidas = () => this.leer<GeoJSON>('uso_suelo/areas_protegidas_junin.geojson');

  /** Cualquier otro archivo listado en manifest.json */
  archivo = <T = unknown>(ruta: string) => this.leer<T>(ruta);
}

/** GeoJSON mínimo (sin depender de @types/geojson) */
export interface GeoJSON {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }[];
}

/** Instancia de la app: lee de /data/junin (public/data/junin en el repo) */
export const JuninRepository = new JuninDataSource(lectorFetch(`${import.meta.env.BASE_URL}data/junin`));
