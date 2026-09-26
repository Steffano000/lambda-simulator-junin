/**
 * Luces de la escena: una hemisférica (cielo + rebote del suelo) y una direccional.
 * Sin sombras, sin AO ni profundidad de campo (design.md §2): la legibilidad del estado
 * gana al realismo. Los colores salen de los tokens de luz y la intensidad se modula
 * con el estado del cielo del día (tokens.cielo[estado].luz): un día de lluvia ve la
 * parcela más apagada que uno despejado.
 */
import { useCieloVisual } from '@/controllers/hooks';
import { cielo, luz } from '@/theme/tokens';

const HEMISFERICA = { intensidad: 1.1 } as const;
const DIRECCIONAL = { posicion: [10, 18, 8] as const, intensidad: 1.4 };

export function Lighting() {
  const { estado } = useCieloVisual();
  const factor = cielo[estado].luz;

  return (
    <>
      <hemisphereLight args={[luz.cielo, luz.suelo, HEMISFERICA.intensidad * factor]} />
      <directionalLight
        color={luz.direccional}
        position={DIRECCIONAL.posicion}
        intensity={DIRECCIONAL.intensidad * factor}
      />
    </>
  );
}
