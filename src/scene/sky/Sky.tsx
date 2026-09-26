/**
 * Cielo de la escena: el fondo y la niebla siguen el estado del tiempo del día
 * (useCieloVisual → dominio). El color sale de `tokens.cielo` y se interpola con
 * amortiguación exponencial: al avanzar el día el cielo se va teñido, no da un salto.
 *
 * El color va a `scene.background`, que three usa como color de borrado del lienzo: se ve
 * tal cual, sin el mapeo tonal que sí alteran los materiales. La misma pintura se aplica
 * al estilo CSS del lienzo para que el primer frame no destelle en blanco.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useCieloVisual } from '@/controllers/hooks';
import { cielo } from '@/theme/tokens';
import { useTema } from '@/theme/useTema';
import { avanzarColor, rangosNiebla } from './skyVisual';

export function Sky() {
  const { estado } = useCieloVisual();
  const tema = useTema();

  const destino = useMemo(() => new THREE.Color(cielo[estado][tema]), [estado, tema]);
  const color = useRef(new THREE.Color(cielo[estado][tema]));
  const pintado = useRef(false);

  // Todo lo que se toca aquí es del renderer (escena y lienzo), no del estado de React:
  // gl, scene y camera llegan como argumentos del frame, no como valores del render.
  useFrame(({ gl, scene, camera }, delta) => {
    const actual = color.current;
    const movido = avanzarColor(actual, destino, delta);

    if (pintado.current || movido) {
      gl.domElement.style.backgroundColor = `#${actual.getHexString()}`;
      pintado.current = true;
    }

    // `scene.background` como Color: three lo usa como color de borrado, sin tone mapping.
    if (scene.background instanceof THREE.Color) scene.background.copy(actual);
    else scene.background = actual.clone();

    const { near, far } = rangosNiebla(camera.position.length());
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(actual);
      scene.fog.near = near;
      scene.fog.far = far;
    } else {
      scene.fog = new THREE.Fog(actual.clone(), near, far);
    }
  });

  return null;
}
