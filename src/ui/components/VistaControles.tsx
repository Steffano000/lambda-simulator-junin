/**
 * Opciones de vista de la escena 3D (Fases 4 y 5): nubes, su sombra y, en la parcela real,
 * terreno en bloques o continuo, suavizado y exageración vertical. No cambian la simulación.
 */
import { useMemo, useState } from 'react';
import { EXAGERACION_RELIEVE } from '@/domain/junin/puente';
import { construirHeightfield, pendienteCelda } from '@/scene/terrain';
import { useSimStore } from '@/store/useSimStore';
import { useVistaStore, vista } from '@/store/vistaStore';
import { useJuninStore } from '@/store/juninStore';

export function VistaControles() {
  const v = useVistaStore();
  const [abierto, setAbierto] = useState(false);
  const parcelaReal = useSimStore((s) => s.tiles.some((t) => t.ladoM != null));
  const celda = useJuninStore((s) => s.chunks?.celda_m ?? null);
  const terreno = useSimStore((s) => s.terreno);
  const tiles = useSimStore((s) => s.tiles);
  const config = useSimStore((s) => s.config);
  const srtm = useJuninStore((s) => s.resumen?.pendiente_media_grados ?? null);
  // Pendiente recalculada sobre la superficie continua (diferencias finitas), para comparar con SRTM
  const pendiente = useMemo(() => {
    if (!abierto || !parcelaReal) return null;
    const alturas: (number | null)[] = new Array(config.rows * config.cols).fill(null);
    for (const t of tiles)
      if (!t.oculto && !t.sinAltura) alturas[t.coords.z * config.cols + t.coords.x] = t.elevacion;
    const hf = construirHeightfield(config.rows, config.cols, alturas, v.suavizado);
    const ps = tiles
      .filter((t) => !t.oculto && !t.sinAltura)
      .map((t) => pendienteCelda(hf, t.coords.z, t.coords.x, EXAGERACION_RELIEVE))
      .filter((x): x is number => x != null);
    return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
  }, [abierto, parcelaReal, tiles, config, v.suavizado]);
  if (!terreno) return null;
  return (
    <div className="absolute right-4 bottom-4 z-hud flex flex-col items-end gap-1">
      {abierto && (
        <div className="panel w-60 space-y-2 p-3 text-xs" role="dialog" aria-label="Opciones de vista">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={v.nubes} onChange={() => vista.set({ nubes: !v.nubes })} />
            Nubes del día
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={v.sombraNubes}
              disabled={!v.nubes}
              onChange={() => vista.set({ sombraNubes: !v.sombraNubes })}
            />
            Sombra de las nubes
          </label>
          {parcelaReal && (
            <>
              <div>
                <div className="mb-1 text-2xs text-ui-ink-muted">Terreno</div>
                <div className="grid grid-cols-2 gap-1">
                  {(['continuo', 'bloques'] as const).map((m) => (
                    <button
                      key={m}
                      className={`btn justify-center ${v.terreno === m ? 'btn-active' : ''}`}
                      onClick={() => vista.set({ terreno: m })}
                    >
                      {m === 'continuo' ? 'Continuo' : 'Bloques'}
                    </button>
                  ))}
                </div>
              </div>
              {v.terreno === 'continuo' && (
                <label className="block">
                  <span className="text-2xs text-ui-ink-muted">Suavizado: {v.suavizado}</span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={v.suavizado}
                    onChange={(e) => vista.set({ suavizado: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-2xs text-ui-ink-muted">Exageración vertical: ×{v.exageracion}</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.5}
                  value={v.exageracion}
                  onChange={(e) => vista.set({ exageracion: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              {pendiente != null && (
                <p className="text-2xs">
                  Pendiente media de la superficie: <b>{pendiente.toFixed(1)}°</b>
                  {srtm != null && ` (SRTM 90 m: ${srtm.toFixed(1)}°)`}
                </p>
              )}
              <p className="text-2xs text-ui-ink-muted">
                Cada celda mide {celda ?? '—'} m de lado; la altura se multiplica por ×{v.exageracion} para
                que el relieve se lea. Nada de esto cambia los cálculos.
              </p>
            </>
          )}
        </div>
      )}
      <button className="btn shadow-panel" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        Vista {abierto ? '▾' : '▴'}
      </button>
    </div>
  );
}
