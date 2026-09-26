/**
 * Tema efectivo de la interfaz. styles/index.css resuelve el tema por
 * `prefers-color-scheme` y permite forzarlo con `<html data-theme>`; este hook lee esa
 * misma decisión para lo que necesita saber el tema en JS (el fondo de la escena).
 */
import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

const prefersOscuro = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function temaActual(): Tema {
  const forzado = document.documentElement.dataset.theme;
  if (forzado === 'light') return 'claro';
  if (forzado === 'dark') return 'oscuro';
  return prefersOscuro() ? 'oscuro' : 'claro';
}

/** Tema actual, reactivándose si el sistema cambia de tema con la app abierta. */
export function useTema(): Tema {
  const [tema, setTema] = useState(temaActual);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = () => setTema(temaActual());
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  return tema;
}
