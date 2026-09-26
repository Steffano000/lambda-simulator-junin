/**
 * Vista previa del crecimiento de un cultivo: la misma planta en cada etapa, de la siembra
 * a la cosecha, sobre bloques de suelo con surcos. Usa los mismos modelos que el terreno
 * (cropModels), así que lo que se ve aquí es exactamente lo que crecerá en la parcela.
 *
 * Lienzo propio y ligero (pocas piezas): mallas sueltas en vez de instancing.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { GEOMETRIA, matrizPieza } from '@/scene/crops/cropGeometry';
import { modeloPlanta, type EstadoPlanta } from '@/scene/crops/cropModels';
import { Lighting } from '@/scene/lighting';
import { ALTURA_LOMO } from '@/scene/tiles';

export interface EtapaPrevia {
  estado: EstadoPlanta;
  etiqueta: string;
}

const SEPARACION = 1.25;
const ALTO_BLOQUE = 0.35;
const LOMOS = [-1 / 3, 0, 1 / 3];
const BLOQUE = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

function Parcela({ x, suelo }: { x: number; suelo: string }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={BLOQUE} scale={[0.96, ALTO_BLOQUE, 0.96]}>
        <meshLambertMaterial color={suelo} flatShading />
      </mesh>
      {LOMOS.map((dz) => (
        <mesh key={dz} geometry={BLOQUE} position={[0, ALTO_BLOQUE, dz]} scale={[0.96, ALTURA_LOMO, 0.2]}>
          <meshLambertMaterial color={suelo} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Planta({ cultivo, estado, x }: { cultivo: string; estado: EstadoPlanta; x: number }) {
  const piezas = useMemo(() => {
    const y = ALTO_BLOQUE + ALTURA_LOMO;
    return modeloPlanta(cultivo, estado).map((p) => ({ p, m: matrizPieza(p, x, y, 0, 0.6) }));
  }, [cultivo, estado, x]);

  return (
    <>
      {piezas.map(({ p, m }, i) => (
        <mesh key={i} geometry={GEOMETRIA[p.forma]} matrix={m} matrixAutoUpdate={false}>
          <meshLambertMaterial color={p.color} flatShading />
        </mesh>
      ))}
    </>
  );
}

/** Altura máxima (m) que alcanza la planta en las etapas mostradas. */
function alturaMaxima(cultivo: string, etapas: readonly EtapaPrevia[]): number {
  let max = 0.2;
  for (const e of etapas) {
    for (const p of modeloPlanta(cultivo, e.estado)) {
      max = Math.max(max, p.pos[1] + (p.forma === 'esfera' ? p.esc[1] / 2 : p.esc[1]));
    }
  }
  return max;
}

/**
 * Encuadre según el cultivo: el ancho de la tira fija la distancia y la altura de la planta
 * fija la elevación, para que una papa baja se lea tan bien como un maíz alto.
 */
function Encuadre({ ancho, alto }: { ancho: number; alto: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const objetivoY = -0.4 + ALTO_BLOQUE + alto * 0.45;
    camera.position.set(0, objetivoY + 0.7 + alto * 0.6, 3.4 + ancho * 0.6);
    camera.lookAt(0, objetivoY, 0);
  }, [camera, ancho, alto]);
  return null;
}

export interface GrowthStripProps {
  cultivo: string;
  etapas: readonly EtapaPrevia[];
  /** Color del suelo del terreno elegido */
  suelo: string;
  className?: string;
  /** Permite girar la vista con el ratón */
  interactiva?: boolean;
}

export function GrowthStrip({ cultivo, etapas, suelo, className, interactiva = false }: GrowthStripProps) {
  const ancho = (etapas.length - 1) * SEPARACION;
  const alto = useMemo(() => alturaMaxima(cultivo, etapas), [cultivo, etapas]);
  const objetivoY = -0.4 + ALTO_BLOQUE + alto * 0.45;
  return (
    <Canvas
      className={className}
      camera={{ position: [0, 2.2, 4.6 + ancho * 0.55], fov: 32 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      aria-label={`Crecimiento de ${cultivo}: ${etapas.map((e) => e.etiqueta).join(', ')}`}
    >
      <Encuadre ancho={ancho} alto={alto} />
      <Lighting />
      <group position={[-ancho / 2, -0.4, 0]}>
        {etapas.map((e, i) => (
          <group key={e.etiqueta}>
            <Parcela x={i * SEPARACION} suelo={suelo} />
            <Planta cultivo={cultivo} estado={e.estado} x={i * SEPARACION} />
          </group>
        ))}
      </group>
      <OrbitControls
        enabled={interactiva}
        enableZoom={interactiva}
        enablePan={false}
        target={[0, objetivoY, 0]}
        minPolarAngle={0.6}
        maxPolarAngle={1.45}
      />
    </Canvas>
  );
}
