/**
 * Paso 01–02 · Reglas físicas del suelo (EP-03.1).
 * Convierte humedad volumétrica ↔ % entre PMP y CC usando data/terrenos.json.
 */
import type { Terreno } from '@/data/types';

/** Humedad relativa 0–100 % → contenido volumétrico (m³/m³) entre PMP y CC. */
export const humedadToTheta = (pct: number, t: Terreno): number =>
  t.pmp_media + (t.cc_media - t.pmp_media) * (Math.min(Math.max(pct, 0), 100) / 100);

/** Contenido volumétrico → humedad relativa 0–100 % (acotada). */
export const thetaToHumedad = (theta: number, t: Terreno): number =>
  Math.min(100, Math.max(0, ((theta - t.pmp_media) / (t.cc_media - t.pmp_media)) * 100));
