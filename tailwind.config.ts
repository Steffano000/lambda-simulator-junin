import type { Config } from 'tailwindcss';
import { chi, chiEstado, divergente, etapa, humedad, serie, soil, surface } from './src/theme/tokens';

/**
 * Tailwind v4 — cargado desde src/styles/index.css con `@config`.
 * Los colores de datos salen de src/theme/tokens.ts (misma fuente que Three.js),
 * los de interfaz de variables CSS para soportar tema claro/oscuro.
 *
 * Ejemplos: bg-soil-franco · bg-humedad-60 · text-chi-25 · bg-etapa-media ·
 *           bg-div-n2 · bg-serie-agua · bg-ui-panel · text-ui-ink-muted · z-inspector
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Interfaz (tema claro/oscuro vía variables CSS)
        ui: {
          bg: 'var(--ui-bg)',
          panel: 'var(--ui-panel)',
          'panel-2': 'var(--ui-panel-2)',
          border: 'var(--ui-border)',
          ink: 'var(--ui-ink)',
          'ink-muted': 'var(--ui-ink-muted)',
          accent: 'var(--ui-accent)',
          'accent-ink': 'var(--ui-accent-ink)',
          focus: 'var(--ui-focus)',
          danger: 'var(--ui-danger)',
          scene: 'var(--ui-scene)',
        },
        // Datos del simulador (design.md §3)
        soil,
        surface,
        humedad,
        chi: { ...chi, ...chiEstado },
        div: divergente,
        etapa,
        serie,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Densidad alta para paneles de datos
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        inspector: '20rem',
        toolbar: '3.25rem',
      },
      width: {
        inspector: '20rem',
      },
      zIndex: {
        hud: '10',
        legend: '20',
        inspector: '30',
        toolbar: '40',
        modal: '50',
      },
      borderRadius: {
        panel: '0.75rem',
      },
      boxShadow: {
        panel: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
      },
      transitionDuration: {
        // Transición superficie ↔ corte: animada y continua (design.md §1)
        cutaway: '600ms',
      },
      keyframes: {
        'panel-in': {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'panel-in': 'panel-in 180ms ease-out',
      },
    },
  },
} satisfies Config;
