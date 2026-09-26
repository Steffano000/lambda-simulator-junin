/**
 * Paso 1 · Selección del terreno (inicio obligatorio). La textura y la reacción del
 * suelo determinan acciones, requisitos y cultivos posibles; se muestran antes de confirmar.
 */
import { container } from '@/app/container';
import { useControllers } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import { SIZE_PRESETS, type SizePreset } from '@/domain/grid';
import { REACCION_ETIQUETA, TEXTURA_ETIQUETA, texturaDe, type ReaccionPh } from '@/domain/terrain';
import { useSimStore } from '@/store/useSimStore';
import { soilColor } from '@/theme/ramps';
import { Section } from '../panels/Section';

const TAMANOS: { id: SizePreset; label: string }[] = [
  { id: 'demo', label: 'Demo' },
  { id: 'parcela', label: 'Parcela' },
  { id: 'microcuenca', label: 'Microcuenca' },
];

export function TerrainStep() {
  const { terrain } = useControllers();
  const opciones = useSimStore((s) => s.opcionesTerreno);
  const mesInicio = useSimStore((s) => s.mesInicio);
  const suelo = container.soilOf(opciones.clase);
  const textura = texturaDe(opciones.clase);
  const aptos = container.crops.all().filter((c) => c.texturaCompatible(textura));
  const noAptos = container.crops.all().filter((c) => !c.texturaCompatible(textura));
  const perfil = container.terrains.createProfile(opciones);
  const tratamientos = container.commands
    .ids('tratamiento')
    .map((id) => container.commands.create(id))
    .filter((c) => c.aplicaA(perfil));

  return (
    <>
      <Section titulo="1 · Tipo de suelo">
        <ul className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Clase de suelo">
          {container.terrains.clases().map((t) => {
            const activo = t.clase === opciones.clase;
            return (
              <li key={t.clase}>
                <button
                  role="radio"
                  aria-checked={activo}
                  onClick={() => terrain.preview({ clase: t.clase })}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-2xs ${
                    activo
                      ? 'border-ui-accent bg-ui-panel-2 font-medium'
                      : 'border-ui-border hover:bg-ui-panel-2'
                  }`}
                >
                  <span className="swatch" style={{ backgroundColor: soilColor(t.clase) }} />
                  {t.clase}
                </button>
              </li>
            );
          })}
        </ul>
        {suelo && (
          <p className="mt-2 text-2xs text-ui-ink-muted">
            {TEXTURA_ETIQUETA[textura]} · CC {suelo.cc_media} · PMP {suelo.pmp_media} · agua útil{' '}
            {suelo.agua_util_mm_m} mm/m
          </p>
        )}
      </Section>

      <Section titulo="2 · Reacción del suelo (pH)">
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(REACCION_ETIQUETA) as ReaccionPh[]).map((r) => (
            <button
              key={r}
              className={`btn justify-center ${opciones.reaccion === r ? 'btn-active' : ''}`}
              aria-pressed={opciones.reaccion === r}
              onClick={() => terrain.preview({ reaccion: r })}
            >
              {REACCION_ETIQUETA[r]}
            </button>
          ))}
        </div>
      </Section>

      <Section titulo="3 · Tamaño e inicio">
        <div className="mb-2 grid grid-cols-3 gap-1">
          {TAMANOS.map((t) => (
            <button
              key={t.id}
              className={`btn flex-col justify-center gap-0 ${opciones.tamano === t.id ? 'btn-active' : ''}`}
              aria-pressed={opciones.tamano === t.id}
              onClick={() => terrain.preview({ tamano: t.id })}
            >
              {t.label}
              <span className="value text-2xs opacity-70">
                {SIZE_PRESETS[t.id].rows}×{SIZE_PRESETS[t.id].cols}
              </span>
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-ui-ink-muted">
          Mes de inicio
          <select
            className="field w-24"
            value={mesInicio}
            onChange={(e) => terrain.setMesInicio(Number(e.target.value))}
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section titulo="Este terreno determina">
        <dl className="space-y-2 text-2xs">
          <div>
            <dt className="font-medium text-ui-ink">Cultivos aptos por textura</dt>
            <dd className="text-ui-ink-muted">{aptos.map((c) => c.nombre).join(', ') || '—'}</dd>
          </div>
          {noAptos.length > 0 && (
            <div>
              <dt className="font-medium text-ui-ink">No aptos</dt>
              <dd className="text-ui-ink-muted">
                {noAptos.map((c) => `${c.nombre} (prefiere ${c.datos.textura_preferida})`).join(', ')}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-ui-ink">Tratamientos posibles</dt>
            <dd className="text-ui-ink-muted">{tratamientos.map((c) => c.etiqueta).join(', ')}</dd>
          </div>
          <div>
            <dt className="font-medium text-ui-ink">Estado inicial</dt>
            <dd className="text-ui-ink-muted">Todas las celdas baldías: hay que arar antes de sembrar.</dd>
          </div>
        </dl>
        <button className="btn btn-active mt-3 w-full justify-center py-2" onClick={() => terrain.confirm()}>
          Usar este terreno
        </button>
      </Section>
    </>
  );
}
