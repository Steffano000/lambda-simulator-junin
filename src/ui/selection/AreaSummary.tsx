/** Resumen de un área seleccionada (varias celdas): estados, rangos y cultivos presentes. */
import type { TileNode } from '@/domain/grid';
import { CropIcon } from '../icons/CropIcon';
import { Fila, Grupo, PanelSeleccion } from './parts';

const ESTADOS = {
  baldio: 'Baldío',
  arado: 'Arado',
  sembrado: 'Sembrado',
  maduro: 'Maduro',
  cosechado: 'Cosechado',
} as const;

const rango = (xs: number[], dec = 0) => {
  const [a, b] = [Math.min(...xs), Math.max(...xs)];
  return a === b ? a.toFixed(dec) : `${a.toFixed(dec)}–${b.toFixed(dec)}`;
};

export function AreaSummary({ tiles, onCerrar }: { tiles: TileNode[]; onCerrar: () => void }) {
  const estados = new Map<string, number>();
  const cultivos = new Map<string, number>();
  for (const t of tiles) {
    const k = t.canal ? 'Canal' : ESTADOS[t.estado];
    estados.set(k, (estados.get(k) ?? 0) + 1);
    if (t.vegetacionId) cultivos.set(t.vegetacionId, (cultivos.get(t.vegetacionId) ?? 0) + 1);
  }

  return (
    <PanelSeleccion
      etiqueta="Resumen del área seleccionada"
      titulo={`${tiles.length} celdas`}
      subtitulo="Selecciona una sola celda para ver su detalle y el de su cultivo."
      onCerrar={onCerrar}
    >
      <Grupo titulo="Terreno">
        <Fila label="Estados" value={[...estados].map(([k, n]) => `${k} ${n}`).join(' · ')} />
        <Fila label="Humedad" value={rango(tiles.map((t) => t.humedad))} unit="%" />
        <Fila
          label="pH"
          value={rango(
            tiles.map((t) => t.suelo.ph),
            1,
          )}
        />
        <Fila label="N" value={rango(tiles.map((t) => t.suelo.n))} unit="ppm" />
        <Fila
          label="Materia orgánica"
          value={rango(
            tiles.map((t) => t.suelo.materiaOrganica),
            1,
          )}
          unit="%"
        />
      </Grupo>
      {cultivos.size > 0 && (
        <Grupo titulo="Cultivos">
          {[...cultivos].map(([nombre, n]) => (
            <Fila
              key={nombre}
              label={
                <span className="inline-flex items-center gap-1">
                  <CropIcon nombre={nombre} /> {nombre}
                </span>
              }
              value={n}
              unit="celdas"
            />
          ))}
        </Grupo>
      )}
    </PanelSeleccion>
  );
}
