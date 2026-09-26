/** Panel de la CELDA: suelo, estado de trabajo, surcos, agua y nutrientes. */
import { container } from '@/app/container';
import { useValidacion } from '@/controllers/hooks';
import type { TileNode } from '@/domain/grid';
import {
  ETIQUETA_HIDRICA,
  PROFUNDIDAD_SUELO_M,
  SoilHydraulics,
  estadoHidrico,
  tieneSurcos,
} from '@/domain/hydrology';
import { humidityColor, soilColor } from '@/theme/ramps';
import { hidratacion } from '@/theme/tokens';
import { Barra, Fila, Grupo, PanelSeleccion } from './parts';

const ESTADOS = {
  baldio: 'Baldío',
  arado: 'Arado',
  sembrado: 'Sembrado',
  maduro: 'Maduro',
  cosechado: 'Cosechado',
} as const;

const SURCOS = { x: '↔ Este–Oeste', z: '↕ Norte–Sur' } as const;

export function CellPanel({ tile, onCerrar }: { tile: TileNode; onCerrar?: () => void }) {
  const validacion = useValidacion();
  // El motivo de validación solo orienta la siembra: no aplica a una celda ya plantada
  const motivo = tile.vegetacionId ? undefined : validacion?.motivoPorCelda[tile.id];
  const props = container.hidraulica(tile.suelo.clase);
  const raiz = container.crops.find(tile.vegetacionId)?.datos.raiz_m ?? PROFUNDIDAD_SUELO_M;
  const estado = props ? estadoHidrico(tile.humedad, tile.aguaSuperficie, props.saturacionPct) : null;

  return (
    <PanelSeleccion
      etiqueta="Información de la celda"
      titulo={
        <>
          Celda <span className="value">{tile.id}</span>
        </>
      }
      subtitulo={tile.canal ? 'Canal de riego' : `${ESTADOS[tile.estado]} · ${tile.suelo.clase}`}
      icono={
        <span className="swatch block size-5" style={{ backgroundColor: soilColor(tile.suelo.clase) }} />
      }
      onCerrar={onCerrar}
    >
      {motivo && (
        <p className="mb-2 rounded-md bg-ui-panel-2 px-2 py-1 text-2xs text-chi-critico">
          {validacion?.cultivo}: {motivo}
        </p>
      )}

      <Grupo titulo="Terreno">
        <Fila label="Suelo" value={tile.suelo.clase} />
        {props && <Fila label="Textura" value={props.textura} />}
        <Fila label="Estado" value={tile.canal ? 'Canal de riego' : ESTADOS[tile.estado]} />
        {tile.descansoHasta !== null && (
          <Fila label="En descanso" value={`hasta el día ${tile.descansoHasta}`} />
        )}
        <Fila label="Surcos" value={tieneSurcos(tile) && tile.surcos ? SURCOS[tile.surcos] : 'Sin surcos'} />
      </Grupo>

      <Grupo titulo="Agua">
        {estado && (
          <Fila
            label="Estado hídrico"
            value={
              <span className="inline-flex items-center gap-1">
                <span className="swatch" style={{ backgroundColor: hidratacion[estado] }} />
                {ETIQUETA_HIDRICA[estado]}
              </span>
            }
          />
        )}
        <Fila label="Humedad" value={Math.round(tile.humedad)} unit="% agua útil" />
        <Barra
          valor={(tile.humedad / (props?.saturacionPct ?? 100)) * 100}
          color={humidityColor(tile.humedad)}
        />
        <Fila label="Agua en superficie" value={tile.aguaSuperficie.toFixed(1)} unit="mm" />
        {tile.diasEncharcado > 0 && <Fila label="Días encharcada" value={tile.diasEncharcado} />}
        {props && (
          <>
            <Fila
              label="Capacidad (capa activa)"
              value={SoilHydraulics.capacidadMm(props, raiz).toFixed(0)}
              unit="mm"
            />
            <Fila label="Saturación" value={props.saturacionPct} unit="%" />
            <Fila label="Absorción" value={props.absorcionMmH} unit="mm/h" />
            <Fila label="Drenaje" value={Math.round(props.drenajeDia * 100)} unit="%/día" />
          </>
        )}
      </Grupo>

      <Grupo titulo="Química del suelo">
        <Fila label="pH" value={tile.suelo.ph.toFixed(1)} />
        <Fila label="N · P · K" value={`${tile.suelo.n} · ${tile.suelo.p} · ${tile.suelo.k}`} unit="ppm" />
        <Fila label="Materia orgánica" value={tile.suelo.materiaOrganica} unit="%" />
      </Grupo>
    </PanelSeleccion>
  );
}
