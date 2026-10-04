#!/usr/bin/env node
/**
 * Fase 6 · Chequeo de salud de las fuentes de datos (npm run salud).
 *
 * 1. Datos locales: cada archivo de public/data/junin/manifest.json existe, es JSON válido y no
 *    trae NaN ni Infinity. Muestra la fecha de generación y el último mes observado del clima.
 * 2. Servicios en vivo: una tesela de NASA GIBS, de Esri y de EOX, y una consulta mínima a la
 *    API de OpenStreetMap (y /salud del servidor si se define VITE_API_URL).
 *
 * Sale con código 1 si fallan los datos locales (sin ellos la app no funciona). Los servicios
 * en vivo solo se informan: si fallan, la app avisa y sigue.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = resolve(RAIZ, 'public/data/junin');
const filas = [];
const fila = (grupo, nombre, ok, detalle) => filas.push({ grupo, nombre, ok, detalle });

// ---------- 1. Datos locales
let localOk = true;
const ruta = resolve(DATOS, 'manifest.json');
if (!existsSync(ruta)) {
  fila('local', 'manifest.json', false, 'no existe');
  localOk = false;
} else {
  const man = JSON.parse(readFileSync(ruta, 'utf-8'));
  let malos = 0;
  for (const a of man.archivos) {
    const f = resolve(DATOS, a.archivo);
    if (!existsSync(f)) {
      fila('local', a.archivo, false, 'no existe');
      malos++;
      continue;
    }
    const texto = readFileSync(f, 'utf-8');
    try {
      JSON.parse(texto);
      if (/\bNaN\b|-?Infinity\b/.test(texto)) {
        fila('local', a.archivo, false, 'tiene NaN o Infinity');
        malos++;
      }
    } catch (e) {
      fila('local', a.archivo, false, `JSON inválido: ${e.message}`);
      malos++;
    }
  }
  localOk = malos === 0;
  const sim = resolve(DATOS, 'app/simulador_escenarios.json');
  const ultimo = existsSync(sim) ? JSON.parse(readFileSync(sim, 'utf-8')).meta?.ultimo_mes_observado : null;
  const edadDias = Math.round((Date.now() - Date.parse(man.generado)) / 86_400_000);
  fila(
    'local',
    `${man.archivos.length} archivos (${man.total_mb} MB)`,
    localOk,
    `generados ${man.generado} (hace ${edadDias} días) · clima observado hasta ${ultimo ?? '—'}${malos ? ` · ${malos} con problemas` : ''}`,
  );
  if (edadDias > 45)
    fila('local', 'frescura', true, 'AVISO: más de 45 días; conviene volver a correr el pipeline');
}

// ---------- 2. Servicios en vivo
const ayer = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const SERVICIOS = [
  [
    'NASA GIBS (MODIS)',
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${ayer}/GoogleMapsCompatible_Level9/6/33/19.jpeg`,
  ],
  [
    'Esri World Imagery',
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/33/19',
  ],
  ['EOX Sentinel-2 2023', 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/6/33/19.jpg'],
  ['OpenStreetMap API', 'https://api.openstreetmap.org/api/0.6/map?bbox=-75.5005,-11.7755,-75.4995,-11.7745'],
];
if (process.env.VITE_API_URL) SERVICIOS.push(['Servidor Fase 2', `${process.env.VITE_API_URL}/salud`]);

for (const [nombre, url] of SERVICIOS) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    fila('en vivo', nombre, r.ok, `HTTP ${r.status} en ${Date.now() - t0} ms`);
  } catch (e) {
    fila('en vivo', nombre, false, `${e.cause?.code ?? e.name}: ${e.message}`);
  }
}

// ---------- Informe
const ancho = Math.max(...filas.map((f) => f.nombre.length));
for (const f of filas)
  console.log(`${f.ok ? '✔' : '✘'} [${f.grupo.padEnd(7)}] ${f.nombre.padEnd(ancho)}  ${f.detalle}`);
console.log(localOk ? '\nDatos locales: OK' : '\nDatos locales: CON PROBLEMAS');
process.exit(localOk ? 0 : 1);
