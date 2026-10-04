/**
 * Luces de la escena: una hemisférica (cielo + rebote del suelo) y una direccional.
 * Sin sombras por defecto (la de las nubes es opcional, Fase 4), sin AO ni profundidad de campo (design.md §2): la legibilidad del estado
 * gana al realismo. Los colores salen de los tokens de luz y la intensidad se modula
 * con el estado del cielo del día (tokens.cielo[estado].luz): un día de lluvia ve la
 * parcela más apagada que uno despejado.
 */
import { useCieloVisual } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { useVistaStore } from '@/store/vistaStore';
import { cielo, luz } from '@/theme/tokens';

const HEMISFERICA = { intensidad: 1.1 } as const;
const DIRECCIONAL = { posicion: [10, 18, 8] as const, intensidad: 1.4 };

export function Lighting() {
  const { estado } = useCieloVisual();
  const factor = cielo[estado].luz;
  // Sombra de nubes (Fase 4, opcional): la luz se aleja según el tamaño de la grilla y su
  // cámara de sombras cubre toda la parcela
  const sombra = useVistaStore((s) => s.sombraNubes);
  const { rows, cols } = useSimStore((s) => s.config);
  const escala = Math.max(1, Math.hypot(rows, cols) / 20);
  const lado = Math.hypot(rows, cols);
  const [px, py, pz] = DIRECCIONAL.posicion;

  return (
    <>
      <hemisphereLight args={[luz.cielo, luz.suelo, HEMISFERICA.intensidad * factor]} />
      <directionalLight
        color={luz.direccional}
        position={[px * escala, py * escala, pz * escala]}
        intensity={DIRECCIONAL.intensidad * factor}
        castShadow={sombra}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-lado}
        shadow-camera-right={lado}
        shadow-camera-top={lado}
        shadow-camera-bottom={-lado}
        shadow-camera-near={0.5}
        shadow-camera-far={lado * 6}
      />
    </>
  );
}
