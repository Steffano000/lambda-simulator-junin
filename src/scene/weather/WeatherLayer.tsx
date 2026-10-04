/**
 * Clima visible sobre la parcela (tiempo de HOY, WeatherGenerator vía useClimaHoy).
 *
 * Fase 4:
 *  - Nubes suaves (elipsoides lisos agrupados) con su base SIEMPRE por encima del punto más alto
 *    del terreno + margen (cloudPlan.ts): no chocan con el relieve exagerado de la parcela real.
 *  - Cuántas nubes: cobertura del día (probabilidad de lluvia del escenario y si llueve).
 *  - Variación con semilla (terreno + día) y tamaño según la grilla.
 *  - Sombra opcional y botón para ocultarlas (store de vista).
 *  - La lluvia cae desde la base de las nubes hasta la superficie de CADA celda (no atraviesa
 *    el relieve).
 * La nube es solo la representación del evento climático, no una acción de riego.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useClimaHoy } from '@/controllers/hooks';
import type { Intensidad } from '@/domain/climate';
import { createRng } from '@/domain/shared/random';
import { InstanceField, getMaterial } from '@/scene/render';
import { gridOffset, tileCenter, tileSurfaceY } from '@/scene/tiles';
import { useSimStore } from '@/store/useSimStore';
import { useVistaStore } from '@/store/vistaStore';
import { clima } from '@/theme/tokens';
import { coberturaDia, planNubes, type PuffNube } from './cloudPlan';

/**
 * Lluvia proporcional (no realista): gotas por unidad² SOLO bajo cada nube, según la intensidad.
 * Así llueve donde hay nube y la lluvia no tapa la parcela.
 */
const GOTAS_POR_U2: Record<Intensidad, number> = {
  debil: 0.25,
  moderada: 0.5,
  fuerte: 0.9,
  'muy-fuerte': 1.4,
};
const MAX_GOTAS = 3000;
/** Segundos que tarda una gota en caer desde la base de la nube (la velocidad se ajusta a la altura) */
const SEGUNDOS_CAIDA = 2.2;
/** Altura que pueden alcanzar las plantas sobre la celda (las nubes van por encima) */
const ALTO_PLANTAS = 1.6;

/** Esfera lisa (subdividida): la nube no se ve pixelada */
const PUFF = new THREE.IcosahedronGeometry(1, 3);

function Clouds({ puffs, lluvia, sombra }: { puffs: PuffNube[]; lluvia: boolean; sombra: boolean }) {
  // Quietas: la lluvia cae justo debajo de cada nube
  return (
    <group>
      <InstanceField
        geometry={PUFF}
        material={getMaterial('nube')}
        items={puffs}
        deps={[lluvia]}
        castShadow={sombra}
        place={(batch, p, i) => batch.place(i, p.x, p.y, p.z, p.rx, p.ry, p.rz)}
        paint={() => (lluvia ? clima.nubeLluvia : clima.nube)}
      />
    </group>
  );
}

function Rain({
  nubes,
  intensidad,
  altura,
  suelo,
  seed,
}: {
  nubes: { x: number; z: number; r: number }[];
  intensidad: Intensidad;
  altura: number;
  /** Altura de la superficie bajo (x, z) */
  suelo: (x: number, z: number) => number;
  seed: number;
}) {
  const { geometria, pisos, largo, velocidad } = useMemo(() => {
    const azar = createRng(seed + nubes.length);
    const area = nubes.reduce((a, n) => a + Math.PI * n.r * n.r, 0);
    const cantidad = Math.min(MAX_GOTAS, Math.round(area * GOTAS_POR_U2[intensidad]));
    // gota y velocidad proporcionales a la altura de caída
    const caida = Math.max(1, altura - Math.min(...nubes.map((n) => suelo(n.x, n.z))));
    const largo = Math.max(0.3, caida * 0.04);
    const velocidad = caida / SEGUNDOS_CAIDA;
    const pos = new Float32Array(cantidad * 6);
    const pisos = new Float32Array(cantidad);
    for (let i = 0; i < cantidad; i++) {
      // un punto al azar bajo una nube (las más grandes reciben más gotas)
      let k = azar() * area;
      let n = nubes[0];
      for (const m of nubes) {
        k -= Math.PI * m.r * m.r;
        n = m;
        if (k <= 0) break;
      }
      const a = azar() * Math.PI * 2;
      const d = Math.sqrt(azar()) * n.r * 0.85;
      const x = n.x + Math.cos(a) * d;
      const z = n.z + Math.sin(a) * d * 0.7;
      pisos[i] = suelo(x, z);
      const y = pisos[i] + azar() * (altura - pisos[i]);
      pos.set([x, y, z, x, y - largo, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geometria: g, pisos, largo, velocidad };
  }, [nubes, intensidad, altura, suelo, seed]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: clima.gota, transparent: true, opacity: 0.35 }),
    [],
  );

  useEffect(() => () => geometria.dispose(), [geometria]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const attr = geometria.getAttribute('position') as THREE.BufferAttribute;
    const a = attr.array as Float32Array;
    const bajada = velocidad * Math.min(dt, 0.05);
    for (let i = 0, k = 0; i < a.length; i += 6, k++) {
      a[i + 1] -= bajada;
      a[i + 4] -= bajada;
      if (a[i + 4] < pisos[k]) {
        a[i + 1] = altura;
        a[i + 4] = altura - largo;
      }
    }
    attr.needsUpdate = true;
  });

  return <lineSegments geometry={geometria} material={material} raycast={() => null} />;
}

export function WeatherLayer() {
  const hoy = useClimaHoy();
  const config = useSimStore((s) => s.config);
  const tiles = useSimStore((s) => s.tiles);
  const dia = useSimStore((s) => s.dia);
  const verNubes = useVistaStore((s) => s.nubes);
  const sombra = useVistaStore((s) => s.sombraNubes);
  const exageracion = useVistaStore((s) => s.exageracion);
  const { rows, cols, seed } = config;

  // Superficie de cada celda (con la exageración de la vista) y el techo del terreno
  const { techo, suelo } = useMemo(() => {
    const offset = gridOffset(config);
    const k = tiles.some((t) => t.ladoM != null) ? exageracion / 3 : 1;
    const alto = new Map<string, number>();
    let max = 0;
    let min = Infinity;
    for (const t of tiles) {
      if (t.oculto) continue;
      const y = tileSurfaceY(t) + t.elevacion * (k - 1);
      const { x, z } = tileCenter(t, offset);
      alto.set(`${Math.round(x + offset.x)}:${Math.round(z + offset.z)}`, y);
      max = Math.max(max, y);
      min = Math.min(min, y);
    }
    const piso = Number.isFinite(min) ? min : 0;
    return {
      techo: max + ALTO_PLANTAS,
      suelo: (x: number, z: number) =>
        alto.get(`${Math.round(x + offset.x)}:${Math.round(z + offset.z)}`) ?? piso,
    };
  }, [tiles, config, exageracion]);

  const cobertura = coberturaDia(hoy.nubes, hoy.probabilidad, hoy.lluvia?.intensidad ?? null);
  const plan = useMemo(
    () => planNubes({ rows, cols, techo, cobertura, seed: seed * 31 + dia }),
    [rows, cols, techo, cobertura, seed, dia],
  );

  return (
    <>
      {verNubes && plan.puffs.length > 0 && (
        <Clouds puffs={plan.puffs} lluvia={!!hoy.lluvia} sombra={sombra} />
      )}
      {hoy.lluvia && plan.nubes.length > 0 && (
        <Rain
          nubes={plan.nubes}
          intensidad={hoy.lluvia.intensidad}
          altura={plan.base}
          suelo={suelo}
          seed={seed}
        />
      )}
    </>
  );
}
