/**
 * Paso 4 · Cosecha: plantaciones listas para recolectar y las recolecciones completadas
 * con su informe (gasto, venta, balance y recomendación para el suelo).
 */
import { container } from '@/app/container';
import { useControllers } from '@/controllers/hooks';
import { useSimStore } from '@/store/useSimStore';
import { IconCheck } from '../components/icons';
import { IconCosechar } from '../icons';
import { CropIcon } from '../icons/CropIcon';
import { Section } from '../panels/Section';
import { RotacionJunin } from '../junin/PanelCultivoJunin';
import { useEsParcelaReal } from '../junin/useJunin';

const soles = (v: number) => `S/ ${v.toFixed(2)}`;

export function HarvestStep() {
  const { harvest } = useControllers();
  const plantaciones = useSimStore((s) => s.plantaciones);
  const tiles = useSimStore((s) => s.tiles);
  const dia = useSimStore((s) => s.dia);
  const reportes = useSimStore((s) => s.reportes);
  const porId = new Map(tiles.map((t) => [t.id, t]));
  const parcelaReal = useEsParcelaReal();

  const enCampo = plantaciones
    .map((p) => {
      const crop = container.crops.create(p.cultivo);
      return { p, crop, r: container.plantations.resumir(p, porId, crop, dia) };
    })
    .filter(({ r }) => r.activas > 0);

  return (
    <>
      <Section titulo="Listas para cosechar">
        {enCampo.length === 0 ? (
          <p className="text-2xs text-ui-ink-muted">No hay plantaciones en el campo.</p>
        ) : (
          <ul className="space-y-1.5">
            {enCampo.map(({ p, crop, r }) => {
              const faltan = Math.max(0, crop.inicioFinal - r.dias);
              return (
                <li key={p.id} className="rounded-md border border-ui-border p-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <CropIcon nombre={p.cultivo} className="text-base" />
                    {p.id} · {p.cultivo}
                  </div>
                  <p className="mt-0.5 text-2xs text-ui-ink-muted">
                    {r.maduras} de {r.activas} celdas maduras · salud {Math.round(r.saludMedia)}
                    {r.maduras === 0 && ` · ~${faltan} días para la etapa Final`}
                  </p>
                  <button
                    className="btn btn-active mt-1.5 w-full justify-center"
                    disabled={r.maduras === 0}
                    onClick={() => harvest.harvest(p.id)}
                  >
                    <IconCosechar /> Cosechar y vender {r.maduras > 0 ? `(${r.maduras})` : ''}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section titulo={`Recolecciones completadas (${reportes.length})`}>
        {reportes.length === 0 ? (
          <p className="text-2xs text-ui-ink-muted">Al cosechar verás aquí el resumen de cada recolección.</p>
        ) : (
          <ul className="space-y-1">
            {[...reportes].reverse().map((rep) => (
              <li key={rep.id}>
                <button
                  className="w-full rounded-md border border-ui-border px-2 py-1.5 text-left hover:bg-ui-panel-2"
                  onClick={() => harvest.abrir(rep.id)}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <IconCheck className="text-chi-saludable" />
                    <CropIcon nombre={rep.cultivo} />
                    {rep.cultivo} · día {rep.diaCosecha}
                  </span>
                  <span className="mt-0.5 flex justify-between text-2xs text-ui-ink-muted">
                    <span>
                      {rep.produccionKg} kg · {Math.round(rep.areaM2)} m²
                    </span>
                    <span className={`value ${rep.balance >= 0 ? 'text-chi-saludable' : 'text-ui-danger'}`}>
                      {rep.balance >= 0 ? '+' : ''}
                      {soles(rep.balance)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {parcelaReal && <RotacionJunin />}
    </>
  );
}
