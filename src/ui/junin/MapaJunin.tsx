/**
 * Geovisor (rama "ver"): imagen NASA GIBS en vivo, encuadrada en Junín, con el contorno
 * de las provincias, los 10 puntos con datos, el dibujo de la parcela y sus chunks.
 * Nada de lo que se ve aquí entra en los cálculos (eso sale de los JSON locales).
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { juninController } from '@/controllers/JuninController';
import { cuadrado, ETIQUETA_MAPA_NASA, terrenoEnPunto, type Chunk } from '@/domain/junin';
import { useJuninStore, type OverlayNasa } from '@/store/juninStore';
import { BASES_NASA, colorChunk, OVERLAYS_NASA, urlGibs, type CapaGibs } from './colores';
import { useResultadoJunin } from './useJunin';

const JUNIN_BOUNDS = L.latLngBounds([-12.9, -76.8], [-10.4, -73.1]);

export function MapaJunin() {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<{
    base?: L.TileLayer;
    baseHls?: L.TileLayer;
    overlays: Partial<Record<string, L.TileLayer>>;
    fijo?: L.LayerGroup;
    protegidas?: L.GeoJSON;
    dibujo?: L.LayerGroup;
    parcela?: L.LayerGroup;
    chunks?: L.LayerGroup;
  }>({ overlays: {} });
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), []);
  const [hover, setHover] = useState<Chunk | null>(null);
  const [rendHover, setRendHover] = useState<number | null>(null);

  const s = useJuninStore(
    useShallow((st) => ({
      fecha: st.fecha,
      base: st.base,
      overlays: st.overlays,
      verProtegidas: st.verProtegidas,
      dibujando: st.dibujando,
      borrador: st.borrador,
      anillo: st.anillo,
      chunks: st.chunks,
      capaChunk: st.capaChunk,
      region: st.region,
      provincias: st.provincias,
      protegidas: st.protegidas,
      nucleo: st.nucleo,
      parcelas: st.parcelas,
      grilla: st.grilla,
      aviso: st.avisoTeselas,
    })),
  );
  const res = useResultadoJunin();

  // Mapa (una sola vez)
  useEffect(() => {
    if (!div.current || mapa.current) return;
    const m = L.map(div.current, {
      center: [-11.9, -75.2],
      zoom: 8,
      minZoom: 7,
      maxZoom: 16,
      maxBounds: JUNIN_BOUNDS.pad(0.3),
      zoomSnap: 0.5,
      preferCanvas: true,
    });
    mapa.current = m;
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution(
      'Imágenes: NASA GIBS / EOSDIS · Datos: ERA5-Land, PISCO, SoilGrids, ESA WorldCover',
    );
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Imagen base NASA (HLS va encima de MODIS: solo cubre donde hubo pasada ese día)
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    capas.current.base?.remove();
    capas.current.baseHls?.remove();
    const crear = (c: CapaGibs) => {
      let errores = 0;
      const t = L.tileLayer(urlGibs(c, s.fecha), {
        maxNativeZoom: c.nivel,
        maxZoom: 16,
        bounds: JUNIN_BOUNDS.pad(0.3),
      });
      t.on('tileerror', () => {
        errores++;
      });
      t.on('load', () =>
        juninController.avisarTeselas(
          errores > 3 ? `Sin imagen de ${c.nombre} para ${s.fecha}. Prueba otra fecha.` : null,
        ),
      );
      return t;
    };
    const base = crear(BASES_NASA[s.base === 'hls' ? 'modis' : s.base]);
    base.addTo(m);
    base.bringToBack();
    capas.current.base = base;
    if (s.base === 'hls') {
      const hls = crear(BASES_NASA.hls);
      hls.addTo(m);
      capas.current.baseHls = hls;
    }
  }, [s.base, s.fecha]);

  // Capas NASA superpuestas
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const [k, c] of Object.entries(OVERLAYS_NASA)) {
      capas.current.overlays[k]?.remove();
      delete capas.current.overlays[k];
      if (!s.overlays[k as OverlayNasa]) continue;
      const t = L.tileLayer(urlGibs(c, s.fecha), {
        maxNativeZoom: c.nivel,
        maxZoom: 16,
        opacity: k === 'etiquetas' ? 1 : 0.7,
        bounds: JUNIN_BOUNDS.pad(0.3),
      });
      t.addTo(m);
      capas.current.overlays[k] = t;
    }
  }, [s.overlays, s.fecha]);

  // Encuadre: oscurece fuera de Junín, provincias, puntos y ventanas de 30 m
  useEffect(() => {
    const m = mapa.current;
    if (!m || !s.region || !s.provincias || !s.nucleo) return;
    capas.current.fijo?.remove();
    const g = L.layerGroup();
    const mundo: L.LatLngExpression[] = [
      [-30, -100],
      [-30, -50],
      [10, -50],
      [10, -100],
    ];
    const huecos: L.LatLngExpression[][] = [];
    for (const f of s.region.features) {
      const geom = f.geometry as { type: string; coordinates: number[][][] | number[][][][] };
      const polys =
        geom.type === 'Polygon' ? [geom.coordinates as number[][][]] : (geom.coordinates as number[][][][]);
      for (const p of polys) huecos.push(p[0].map(([lon, lat]) => [lat, lon] as L.LatLngTuple));
    }
    L.polygon([mundo, ...huecos], {
      stroke: false,
      fillColor: '#000',
      fillOpacity: 0.55,
      interactive: false,
      renderer,
    }).addTo(g);
    L.geoJSON(s.provincias as unknown as GeoJSON.GeoJsonObject, {
      style: { color: '#ffffff', weight: 1, opacity: 0.8, fill: false },
      interactive: false,
    }).addTo(g);
    for (const p of s.parcelas) {
      const [w, so, e, n] = p.bbox;
      L.rectangle(
        [
          [so, w],
          [n, e],
        ],
        { color: '#FFD54F', weight: 1, dashArray: '4 4', fill: false, interactive: false },
      ).addTo(g);
    }
    for (const p of s.nucleo.puntos) {
      L.circleMarker([p.lat, p.lon], {
        radius: 5,
        color: '#fff',
        weight: 2,
        fillColor: '#1565C0',
        fillOpacity: 1,
      })
        .bindTooltip(`${p.id} · ${p.provincia} · ${p.elevacion_m} m<br/>Recuadro amarillo: datos a 30 m`, {
          direction: 'top',
        })
        .addTo(g);
    }
    g.addTo(m);
    capas.current.fijo = g;
  }, [s.region, s.provincias, s.nucleo, s.parcelas, renderer]);

  // Áreas naturales protegidas
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    capas.current.protegidas?.remove();
    if (!s.verProtegidas || !s.protegidas) return;
    capas.current.protegidas = L.geoJSON(s.protegidas as unknown as GeoJSON.GeoJsonObject, {
      style: { color: '#00E676', weight: 1.5, fillOpacity: 0.12 },
      onEachFeature: (f, l) => l.bindTooltip(`${f.properties?.DESIG ?? ''} ${f.properties?.NAME ?? ''}`),
    }).addTo(m);
  }, [s.verProtegidas, s.protegidas]);

  // Clics: dibujar o consultar el punto
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (s.dibujando) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
    m.getContainer().style.cursor = s.dibujando ? 'crosshair' : '';
    const onClick = (e: L.LeafletMouseEvent) => {
      const st = useJuninStore.getState();
      if (st.dibujando) return juninController.agregarVertice(e.latlng.lat, e.latlng.lng);
      if (!st.grilla) return;
      const t = terrenoEnPunto(st.grilla, e.latlng.lat, e.latlng.lng);
      const caja = document.createElement('div');
      caja.style.fontSize = '12px';
      caja.innerHTML = t
        ? `<b>${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</b><br/>
           Altura ${Math.round(Number(t.elevacion_m))} m · pendiente ${Number(t.pendiente_grados ?? 0).toFixed(1)}°<br/>
           Suelo ${t.textura_app ?? '—'} · pH ${t.ph ?? '—'}<br/>
           Cobertura ${st.nucleo?.reglas.worldcover[String(t.worldcover)]?.nombre ?? '—'}<br/>
           <i style="color:#666">Grilla de Junín a ~1 km</i><br/>`
        : 'Fuera de Junín: el simulador solo está disponible en Junín.<br/>';
      if (t) {
        for (const [lado, txt] of [
          [100, '1 ha aquí'],
          [300, '9 ha aquí'],
        ] as const) {
          const b = document.createElement('button');
          b.textContent = txt;
          b.style.cssText =
            'margin:6px 6px 0 0;padding:2px 8px;border:1px solid #888;border-radius:4px;background:#fff';
          b.onclick = () => {
            m.closePopup();
            void juninController.procesar(cuadrado(e.latlng.lat, e.latlng.lng, lado));
          };
          caja.appendChild(b);
        }
      }
      L.popup().setLatLng(e.latlng).setContent(caja).openOn(m);
    };
    const onDbl = (e: L.LeafletMouseEvent) => {
      if (!useJuninStore.getState().dibujando) return;
      L.DomEvent.stop(e);
      void juninController.terminarDibujo();
    };
    m.on('click', onClick);
    m.on('dblclick', onDbl);
    return () => {
      m.off('click', onClick);
      m.off('dblclick', onDbl);
    };
  }, [s.dibujando]);

  // Borrador del dibujo
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    capas.current.dibujo?.remove();
    if (!s.dibujando || !s.borrador.length) return;
    const g = L.layerGroup();
    const pts = s.borrador.map(([lon, lat]) => [lat, lon] as L.LatLngTuple);
    L.polyline(pts.length > 2 ? [...pts, pts[0]] : pts, {
      color: '#FFEB3B',
      weight: 2,
      dashArray: '6 4',
    }).addTo(g);
    for (const p of pts) L.circleMarker(p, { radius: 4, color: '#FFEB3B', fillOpacity: 1 }).addTo(g);
    g.addTo(m);
    capas.current.dibujo = g;
  }, [s.dibujando, s.borrador]);

  // Parcela y chunks coloreados según la capa elegida
  const rend = res?.rc?.porChunk;
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    capas.current.parcela?.remove();
    capas.current.chunks?.remove();
    if (!s.anillo) return;
    const pts = s.anillo.map(([lon, lat]) => [lat, lon] as L.LatLngTuple);
    const pg = L.layerGroup([
      L.polygon(pts, { color: '#FFEB3B', weight: 2.5, fill: false, interactive: false }),
    ]);
    pg.addTo(m);
    capas.current.parcela = pg;
    if (!s.chunks) return;
    const elevs = s.chunks.chunks.filter((c) => c.dentro && c.elevacion_m != null).map((c) => c.elevacion_m!);
    const ctx = {
      elevMin: Math.min(...elevs),
      elevMax: Math.max(...elevs),
      rendMax: Math.max(0.01, ...(rend ?? []).map((x) => x ?? 0)),
      rend,
    };
    const cg = L.layerGroup();
    const { dlat, dlon } = s.chunks;
    s.chunks.chunks.forEach((c, i) => {
      if (!c.dentro) return;
      const color = colorChunk(c, i, s.capaChunk, ctx);
      L.rectangle(
        [
          [c.lat - dlat / 2, c.lon - dlon / 2],
          [c.lat + dlat / 2, c.lon + dlon / 2],
        ],
        {
          renderer,
          stroke: false,
          fillColor: color ?? '#777',
          fillOpacity: color ? 0.75 : 0.25,
          interactive: false,
        },
      ).addTo(cg);
    });
    cg.addTo(m);
    capas.current.chunks = cg;
  }, [s.anillo, s.chunks, s.capaChunk, rend, renderer]);

  // Encuadrar la parcela nueva
  useEffect(() => {
    const m = mapa.current;
    if (!m || !s.anillo) return;
    m.fitBounds(L.latLngBounds(s.anillo.map(([lon, lat]) => [lat, lon] as L.LatLngTuple)).pad(0.6), {
      maxZoom: 16,
    });
  }, [s.anillo]);

  // Inspector de chunk bajo el cursor
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const onMove = (e: L.LeafletMouseEvent) => {
      const g = useJuninStore.getState().chunks;
      if (!g) return setHover(null);
      const [oeste, , , norte] = g.bbox;
      const col = Math.floor((e.latlng.lng - oeste) / g.dlon);
      const fila = Math.floor((norte - e.latlng.lat) / g.dlat);
      if (col < 0 || fila < 0 || col >= g.columnas || fila >= g.filas) return setHover(null);
      const i = fila * g.columnas + col;
      const c = g.chunks[i];
      setHover(c?.dentro ? c : null);
      setRendHover(c?.dentro ? (rend?.[i] ?? null) : null);
    };
    m.on('mousemove', onMove);
    return () => {
      m.off('mousemove', onMove);
    };
  }, [rend]);

  return (
    <div className="relative h-full w-full">
      <div ref={div} className="h-full w-full bg-[#0b1320]" />
      <div className="pointer-events-none absolute top-2 left-14 z-[500] rounded bg-black/65 px-2 py-1 text-2xs text-white">
        {ETIQUETA_MAPA_NASA} · {BASES_NASA[s.base].nombre} · {s.fecha}
      </div>
      {s.dibujando && (
        <div className="absolute top-10 left-14 z-[500] rounded bg-yellow-300 px-2 py-1 text-xs text-black shadow">
          Clic para agregar vértices · doble clic para cerrar ({s.borrador.length} vértices)
        </div>
      )}
      {s.aviso && (
        <div className="absolute right-2 bottom-8 z-[500] max-w-72 rounded bg-amber-100 px-2 py-1 text-2xs text-amber-900 shadow">
          {s.aviso}
        </div>
      )}
      {hover && (
        <div className="pointer-events-none absolute bottom-8 left-2 z-[500] w-60 rounded bg-white/95 p-2 text-2xs text-black shadow">
          <div className="font-semibold">
            Chunk {hover.fila},{hover.columna} · dato {hover.fuente === '1km' ? 'a ~1 km' : 'a 30 m'}
          </div>
          <div>
            Altura {hover.elevacion_m?.toFixed(0) ?? '—'} m · pendiente{' '}
            {hover.pendiente_grados?.toFixed(1) ?? '—'}°
          </div>
          <div>
            Suelo {hover.textura ?? '—'} · pH {hover.ph?.toFixed(1) ?? '—'} · MO{' '}
            {hover.cos_pct != null ? (hover.cos_pct * 1.724).toFixed(1) : '—'} %
          </div>
          <div>
            Cobertura {s.nucleo?.reglas.worldcover[String(hover.worldcover)]?.nombre ?? '—'} (
            {hover.regla ?? '—'}) · NDVI {hover.ndvi?.toFixed(2) ?? '—'}
          </div>
          {rendHover != null && <div className="font-semibold">Rendimiento {rendHover.toFixed(2)} t/ha</div>}
        </div>
      )}
    </div>
  );
}
