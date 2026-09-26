/**
 * Clima visible sobre la parcela (tiempo de HOY, WeatherGenerator vía useClimaHoy):
 *  - Nubes low-poly cuando la validación meteorológica indica nubosidad; grises si llueve.
 *  - Lluvia: gotas animadas, más densas cuanto mayor es la intensidad.
 * La nube es solo la representación del evento climático, no una acción de riego.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useClimaHoy } from '@/controllers/hooks';
import type { Intensidad } from '@/domain/climate';
import { useSimStore } from '@/store/useSimStore';
import { createRng } from '@/domain/shared/random';
import { InstanceField, getMaterial } from '@/scene/render';
import { clima } from '@/theme/tokens';

/** Gotas por cada 100 celdas según la intensidad de la lluvia. */
const GOTAS: Record<Intensidad, number> = { debil: 220, moderada: 450, fuerte: 800, 'muy-fuerte': 1200 };
const VELOCIDAD = 9; // m/s (escala de la escena)
const LARGO_GOTA = 0.35;

const PUFF = new THREE.IcosahedronGeometry(1, 0);

interface Puff {
  x: number;
  y: number;
  z: number;
  r: number;
}

/** Nubes deterministas repartidas sobre la parcela: varios "puffs" por nube. */
function nubes(rows: number, cols: number, altura: number): Puff[] {
  const n = Math.max(3, Math.round(Math.sqrt(rows * cols) / 3));
  const out: Puff[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.7;
    const radio = 0.32 * Math.max(rows, cols);
    const cx = Math.cos(a) * radio * (0.4 + (k % 3) * 0.3);
    const cz = Math.sin(a) * radio * (0.4 + ((k + 1) % 3) * 0.3);
    for (let p = 0; p < 4; p++) {
      out.push({
        x: cx + (p - 1.5) * 0.9,
        y: altura + (p % 2) * 0.35,
        z: cz + ((p * 7) % 3) * 0.4 - 0.4,
        r: 0.9 + (p % 3) * 0.3,
      });
    }
  }
  return out;
}

function Clouds({ puffs, lluvia }: { puffs: Puff[]; lluvia: boolean }) {
  const grupo = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (grupo.current) grupo.current.rotation.y += dt * 0.02;
  });
  return (
    <group ref={grupo}>
      <InstanceField
        geometry={PUFF}
        material={getMaterial('nube')}
        items={puffs}
        deps={[lluvia]}
        place={(batch, p, i) => batch.place(i, p.x, p.y, p.z, p.r * 0.9, p.r * 0.5, p.r * 0.7)}
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
}: {
  cantidad: number;
  ancho: number;
  fondo: number;
  altura: number;
}) {
  const geometria = useMemo(() => {
    const azar = createRng(cantidad);
    const pos = new Float32Array(cantidad * 6);
    for (let i = 0; i < cantidad; i++) {
      const x = (azar() - 0.5) * ancho;
      const z = (azar() - 0.5) * fondo;
      const y = azar() * altura;
      pos.set([x, y, z, x, y - LARGO_GOTA, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [cantidad, ancho, fondo, altura]);

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
    for (let i = 0; i < a.length; i += 6) {
      a[i + 1] -= bajada;
      a[i + 4] -= bajada;
      if (a[i + 4] < 0.9) {
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
  const { rows, cols } = useSimStore((s) => s.config);
  const altura = 7 + Math.hypot(rows, cols) * 0.25;
  const puffs = useMemo(() => nubes(rows, cols, altura), [rows, cols, altura]);

  return (
    <>
      {hoy.nubes && <Clouds puffs={puffs} lluvia={!!hoy.lluvia} />}
      {hoy.lluvia && (
        <Rain
          cantidad={Math.round((GOTAS[hoy.lluvia.intensidad] * rows * cols) / 100)}
          ancho={cols}
          fondo={rows}
          altura={altura - 0.4}
        />
      )}
    </>
  );
}
