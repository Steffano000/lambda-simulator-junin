/**
 * Paso 1 · Selección del terreno (inicio obligatorio). La mezcla de suelos reparte las
 * clases por la parcela; la textura dominante y la reacción del suelo determinan
 * acciones, requisitos y cultivos posibles. Se muestran antes de confirmar.
 */
import { container } from '@/app/container';
import { useControllers } from '@/controllers/hooks';
import { MESES } from '@/domain/crops';
import { SIZE_PRESETS, type SizePreset } from '@/domain/grid';
import { REACCION_ETIQUETA, TEXTURA_ETIQUETA, SoilMix, type ReaccionPh } from '@/domain/terrain';
import { useSimStore } from '@/store/useSimStore';
import { soilColor } from '@/theme/ramps';
import { ScenarioPicker } from '../climate/ScenarioPicker';
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
  const mezcla = SoilMix.de(opciones.mezcla);
  const partes = mezcla.partes();
  const dominante = container.soilOf(mezcla.dominante);
  const textura = mezcla.textura;
  const aptos = container.crops.all().filter((c) => c.texturaCompatible(textura));
  const noAptos = container.crops.all().filter((c) => !c.texturaCompatible(textura));
  const perfil = container.terrains.createProfile(opciones);
  const tratamientos = container.commands
    .ids('tratamiento')
    .map((id) => container.commands.create(id))
    .filter((c) => c.aplicaA(perfil));

  return (
    <>
      <Section titulo="1 · Mezcla de suelos">
        <div className="grid grid-cols-3 gap-1">
          {container.terrains.mezclas.map((m) => (
            <button
              key={m.id}
              className={`btn flex-col justify-center gap-0 px-1 ${m.id === mezcla.id ? 'btn-active' : ''}`}
              aria-pressed={m.id === mezcla.id}
              onClick={() => terrain.usarMezcla(m.id)}
            >
              {m.nombre}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-2xs text-ui-ink-muted">{mezcla.descripcion}</p>

        {/* Reparto real de la mezcla, antes de la variación natural entre celdas */}
        <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full ring-1 ring-black/10">
          {partes.map((p) => (
            <span
              key={p.clase}
              className="h-full"
              style={{ width: `${p.porcentaje}%`, backgroundColor: soilColor(p.clase) }}
              title={`${p.clase} ${p.porcentaje}%`}
            />
          ))}
        </div>

        <ul className="mt-2 space-y-1.5">
          {container.terrains.clases().map((t) => {
            const valor = mezcla.porcentajeDe(t.clase);
            const esDominante = t.clase === mezcla.dominante;
            const ultimo = valor > 0 && partes.length === 1;
            return (
              <li key={t.clase}>
                <div className="flex items-center gap-2">
                  <span className="swatch" style={{ backgroundColor: soilColor(t.clase) }} />
                  <label className="flex-1 truncate text-2xs" htmlFor={`slider-${t.clase}`}>
                    {t.clase}
                    {esDominante && <span className="ml-1 text-ui-ink-muted">· dominante</span>}
                  </label>
                  <span className="value w-9 text-right text-2xs text-ui-ink-muted">
                    {valor > 0 ? `${valor}%` : '—'}
                  </span>
                </div>
                <input
                  id={`slider-${t.clase}`}
                  className="slider mt-0.5"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={valor}
                  disabled={ultimo}
                  title={ultimo ? 'La parcela necesita al menos una clase de suelo' : undefined}
                  onChange={(e) => terrain.setPorcentaje(t.clase, Number(e.target.value))}
                />
              </li>
            );
          })}
        </ul>

        {dominante && (
          <p className="mt-2 text-2xs text-ui-ink-muted">
            Domina <span className="text-ui-ink">{mezcla.dominante}</span> ({mezcla.porcentajeDominante}%) ·{' '}
            {TEXTURA_ETIQUETA[textura]} · CC {dominante.cc_media} · PMP {dominante.pmp_media} · agua útil{' '}
            {dominante.agua_util_mm_m} mm/m
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

      <Section titulo="4 · Escenario climático">
        <ScenarioPicker />
        <p className="mt-1 text-2xs text-ui-ink-muted">
          Puedes cambiarlo en cualquier momento; afecta desde el siguiente día simulado.
        </p>
      </Section>

      <Section titulo="Este terreno determina">
        <dl className="space-y-2 text-2xs">
          <div>
            <dt className="font-medium text-ui-ink">Cultivos aptos (textura dominante)</dt>
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
            <dd className="text-ui-ink-muted">
              Celdas baldías con la mezcla de suelos por zonas; cada celda usa lasvariables hídricas de su
              clase. Hay que arar antes de sembrar.
            </dd>
          </div>
        </dl>
        <button className="btn btn-active mt-3 w-full justify-center py-2" onClick={() => terrain.confirm()}>
          Usar este terreno
        </button>
      </Section>
    </>
  );
}
