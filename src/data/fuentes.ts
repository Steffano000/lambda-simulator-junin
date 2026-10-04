/**
 * Fase 6 · Origen y frescura de cada fuente de datos.
 *
 * modo:
 *  - local: JSON de public/data/junin generados por el pipeline (se cargan una vez por sesión;
 *    «Actualizar datos» los vuelve a pedir). Su frescura es la fecha de descarga del pipeline.
 *  - en_vivo: se piden al servicio en cada uso (imágenes); si fallan, la app lo dice.
 *  - en_vivo_con_respaldo: en vivo con caché en el navegador por `ttl_h`; si el servicio falla se
 *    usa la última copia buena y se avisa que está vieja.
 *  - opcional: servidor propio (Fase 2), solo si existe VITE_API_URL.
 */
export type ModoFuente = 'local' | 'en_vivo' | 'en_vivo_con_respaldo' | 'opcional';

export interface Fuente {
  id: string;
  nombre: string;
  proveedor: string;
  modo: ModoFuente;
  /** Horas que una copia se considera fresca (null = no caduca en la sesión) */
  ttl_h: number | null;
  /** Cada cuánto cambia el dato en su origen */
  actualizacion: string;
  /** Para qué se usa en la app */
  uso: string;
  /** Paso del pipeline que lo descargó (meta/registro_descargas.json) */
  script?: string;
}

export const FUENTES: Fuente[] = [
  {
    id: 'clima',
    nombre: 'Clima y escenarios (24 meses)',
    proveedor: 'ERA5-Land (Copernicus) + PISCO v3 (SENAMHI); pronóstico SARIMAX',
    modo: 'local',
    ttl_h: null,
    actualizacion: 'mensual (rehacer el pipeline, pasos 02-15)',
    uso: 'escenario climático, balance FAO-56, clima del 3D',
    script: '2',
  },
  {
    id: 'suelo',
    nombre: 'Suelo 0-30 cm',
    proveedor: 'SoilGrids 2.0 (ISRIC)',
    modo: 'local',
    ttl_h: null,
    actualizacion: 'estático (versión 2.0)',
    uso: 'textura, pH, materia orgánica',
    script: '4',
  },
  {
    id: 'relieve',
    nombre: 'Relieve y pendiente',
    proveedor: 'SRTM 90 m (NASA)',
    modo: 'local',
    ttl_h: null,
    actualizacion: 'estático (2000)',
    uso: 'altura, pendiente, relieve 3D',
    script: '3',
  },
  {
    id: 'uso_suelo',
    nombre: 'Uso de suelo y áreas protegidas',
    proveedor: 'ESA WorldCover v200 (2021) · WDPA',
    modo: 'local',
    ttl_h: null,
    actualizacion: 'WorldCover: estático (2021) · WDPA: mensual',
    uso: 'apta / bloqueada',
    script: '10',
  },
  {
    id: 'ndvi',
    nombre: 'NDVI',
    proveedor: 'Sentinel-2 SR (compuesto mensual)',
    modo: 'local',
    ttl_h: null,
    actualizacion: 'mensual (rehacer el pipeline, paso 05)',
    uso: 'capa NDVI de los chunks',
    script: '5',
  },
  {
    id: 'datos_locales',
    nombre: 'Archivos de la app (public/data/junin)',
    proveedor: 'pipeline/codigos/17_exportar_json.py',
    modo: 'local',
    ttl_h: null,
    actualizacion: 'cuando se vuelve a correr el pipeline',
    uso: 'todo lo anterior, ya en JSON',
  },
  {
    id: 'casas',
    nombre: 'Casas y edificaciones',
    proveedor: 'OpenStreetMap (API oficial; respaldo Overpass)',
    modo: 'en_vivo_con_respaldo',
    ttl_h: 24,
    actualizacion: 'continua (la comunidad edita OSM)',
    uso: 'bloqueo de casas con 5 m de margen',
  },
  {
    id: 'nasa_gibs',
    nombre: 'Imágenes NASA del día',
    proveedor: 'NASA GIBS (MODIS, VIIRS, HLS, NDVI, SMAP, IMERG)',
    modo: 'en_vivo',
    ttl_h: null,
    actualizacion: 'diaria (con 1-32 días de latencia según la capa)',
    uso: 'solo para ver (no entra en los cálculos)',
  },
  {
    id: 'imagen_hd',
    nombre: 'Imagen para dibujar',
    proveedor: 'Esri World Imagery · EOX Sentinel-2 2023',
    modo: 'en_vivo',
    ttl_h: null,
    actualizacion: 'varios años según la zona',
    uso: 'solo para dibujar la parcela',
  },
  {
    id: 'servidor',
    nombre: 'Servidor TIF a 30 m (Fase 2)',
    proveedor: 'server/main.py (FastAPI)',
    modo: 'opcional',
    ttl_h: null,
    actualizacion: 'igual que los TIF del pipeline',
    uso: 'chunks a 30 m en cualquier parte de Junín',
  },
];

export const ETIQUETA_MODO: Record<ModoFuente, string> = {
  local: 'Local (pipeline)',
  en_vivo: 'En vivo',
  en_vivo_con_respaldo: 'En vivo + respaldo',
  opcional: 'Opcional',
};

/** Fecha más reciente de descarga por paso del pipeline (meta/registro_descargas.json) */
export function descargasPorScript(
  registro: readonly { fecha_hora: string; script: number | string; estado: string }[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of registro) {
    if (r.estado !== 'ok') continue;
    const k = String(r.script);
    if (!m.has(k) || m.get(k)! < r.fecha_hora) m.set(k, r.fecha_hora);
  }
  return m;
}

/** ¿La copia sigue fresca? */
export const esFresca = (consultado: string, ttl_h: number | null, ahora = Date.now()): boolean =>
  ttl_h == null || ahora - Date.parse(consultado) < ttl_h * 3600_000;
