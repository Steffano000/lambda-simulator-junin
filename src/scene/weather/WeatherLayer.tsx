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
import { useEffect, useMemo, useRef } from 'react';
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

/** Gotas por cada 100 celdas según la intensidad de la lluvia. */
const GOTAS: Record<Intensidad, number> = { debil: 220, moderada: 450, fuerte: 800, 'muy-fuerte': 1200 };
const VELOCIDAD = 9; // m/s (escala de la escena)
const LARGO_GOTA = 0.35;
/** Altura que pueden alcanzar las plantas sobre la celda (las nubes van por encima) */
const ALTO_PLANTAS = 1.6;

/** Esfera lisa (subdividida): la nube no se ve pixelada */
const PUFF = new THREE.IcosahedronGeometry(1, 3);

function Clouds({ puffs, lluvia, sombra }: { puffs: PuffNube[]; lluvia: boolean; sombra: boolean }) {
  const grupo = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    // giro lento alrededor del eje vertical: la base no cambia de altura
    if (grupo.current) grupo.current.rotation.y += dt * 0.02;
  });
  return (
    <group ref={grupo}>
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
  cantidad,
  ancho,
  fondo,
  altura,
  suelo,
  seed,
}: {
  cantidad: number;
  ancho: number;
  fondo: number;
  altura: number;
  /** Altura de la superficie bajo (x, z) */
  suelo: (x: number, z: number) => number;
  seed: number;
}) {
  const { geometria, pisos } = useMemo(() => {
    const azar = createRng(seed + cantidad);
    const pos = new Float32Array(cantidad * 6);
    const pisos = new Float32Array(cantidad);
    for (let i = 0; i < cantidad; i++) {
      const x = (azar() - 0.5) * ancho;
      const z = (azar() - 0.5) * fondo;
      pisos[i] = suelo(x, z);
      const y = pisos[i] + azar() * (altura - pisos[i]);
      pos.set([x, y, z, x, y - LARGO_GOTA, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geometria: g, pisos };
  }, [cantidad, ancho, fondo, altura, suelo, seed]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: clima.gota, transparent: true, opacity: 0.55 }),
    [],
  );

  useEffect(() => () => geometria.dispose(), [geometria]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const attr = geometria.getAttribute('position') as THREE.BufferAttribute;
    const a = attr.array as Float32Array;
    const bajada = VELOCIDAD * Math.min(dt, 0.05);
    for (let i = 0, k = 0; i < a.length; i += 6, k++) {
      a[i + 1] -= bajada;
      a[i + 4] -= bajada;
      if (a[i + 4] < pisos[k]) {
        a[i + 1] = altura;
        a[i + 4] = altura - LARGO_GOTA;
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
      {hoy.lluvia && (
        <Rain
          cantidad={Math.round((GOTAS[hoy.lluvia.intensidad] * rows * cols) / 100)}
          ancho={cols}
          fondo={rows}
          altura={plan.base - 0.2}
          suelo={suelo}
          seed={seed}
        />
      )}
    </>
  );
}
