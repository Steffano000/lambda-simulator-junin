/**
 * Recolección completada: tabla resumen de lo hecho en el área para obtener el cultivo
 * (acciones, insumos, tiempo de riego, mano de obra), lo gastado, lo recuperado al vender,
 * el balance, y la recomendación para el suelo (descanso o rotación).
 */
import { useEffect } from 'react';
import { container } from '@/app/container';
import { useControllers } from '@/controllers/hooks';
import type { ToolId } from '@/domain/actions';
import { ETIQUETA_DEMANDA } from '@/domain/crops';
import { useSimStore } from '@/store/useSimStore';
import { IconClose } from '../components/icons';
import { IconDescansar, VARIABLE_CLIMA } from '../icons';
import { CropIcon, ToolIcon } from '../icons/CropIcon';

const soles = (v: number) => `S/ ${v.toFixed(2)}`;
const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(v < 1 ? 3 : 2));
const etiqueta = (tool: ToolId) => container.commands.create(tool).etiqueta;

function Dato({ label, valor, tono }: { label: string; valor: string; tono?: string }) {
  return (
    <div className="rounded-md bg-ui-panel-2 px-2.5 py-1.5">
      <div className="text-2xs text-ui-ink-muted">{label}</div>
      <div className={`value text-sm font-semibold ${tono ?? 'text-ui-ink'}`}>{valor}</div>
    </div>
  );
}

export function HarvestReportModal() {
  const { harvest } = useControllers();
  const abierto = useSimStore((s) => s.reporteAbierto);
  const rep = useSimStore((s) => s.reportes.find((r) => r.id === s.reporteAbierto) ?? null);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && harvest.cerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, harvest]);

  if (!rep) return null;
  const reco = rep.recomendacion;
  const th = 'py-1 pr-2 text-left font-medium';

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      onClick={() => harvest.cerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reporte-titulo"
        className="panel flex max-h-[90vh] w-full max-w-3xl animate-panel-in flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-ui-border px-4 py-3">
          <CropIcon nombre={rep.cultivo} className="text-3xl" />
          <div>
            <h2 id="reporte-titulo" className="text-sm font-semibold">
              Recolección completada · {rep.cultivo}
            </h2>
            <p className="text-2xs text-ui-ink-muted">
              Plantación {rep.plantacionId} · {rep.areaM2} m² · del día {rep.diaInicio} al {rep.diaCosecha} (
              {rep.diaCosecha - rep.diaInicio} días; {rep.diaCosecha - rep.diaSiembra} desde la siembra)
            </p>
          </div>
          <button className="btn ml-auto px-1.5" onClick={() => harvest.cerrar()} aria-label="Cerrar resumen">
            <IconClose />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dato label="Producción" valor={`${rep.produccionKg} kg`} />
            <Dato label="Gastado" valor={soles(rep.costoTotal)} />
            <Dato label="Recuperado al vender" valor={soles(rep.ingreso)} />
            <Dato
              label="Balance"
              valor={`${rep.balance >= 0 ? '+' : ''}${soles(rep.balance)}`}
              tono={rep.balance >= 0 ? 'text-chi-saludable' : 'text-ui-danger'}
            />
          </div>

          <section>
            <h3 className="mb-1 font-semibold">Acciones realizadas en el área</h3>
            <table className="w-full">
              <thead className="border-b border-ui-border text-2xs text-ui-ink-muted">
                <tr>
                  <th className={th}>Acción</th>
                  <th className={`${th} text-right`}>Veces</th>
                  <th className={`${th} text-right`}>Aplicaciones (celdas)</th>
                  <th className={`${th} text-right`}>Días</th>
                </tr>
              </thead>
              <tbody>
                {rep.acciones.map((a) => (
                  <tr key={a.tool} className="border-b border-ui-border/50">
                    <td className="py-1 pr-2">
                      <span className="inline-flex items-center gap-1.5">
                        <ToolIcon tool={a.tool} /> {etiqueta(a.tool)}
                      </span>
                    </td>
                    <td className="value py-1 pr-2 text-right">{a.veces}</td>
                    <td className="value py-1 pr-2 text-right">{a.aplicaciones}</td>
                    <td className="value py-1 text-right">
                      {a.desde === a.hasta ? a.desde : `${a.desde}–${a.hasta}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="mb-1 font-semibold">Insumos y costos</h3>
            <table className="w-full">
              <thead className="border-b border-ui-border text-2xs text-ui-ink-muted">
                <tr>
                  <th className={th}>Insumo</th>
                  <th className={`${th} text-right`}>Cantidad</th>
                  <th className={`${th} text-right`}>Precio</th>
                  <th className={`${th} text-right`}>Costo</th>
                </tr>
              </thead>
              <tbody>
                {rep.insumos.map((f) => (
                  <tr key={f.insumo} className="border-b border-ui-border/50">
                    <td className="py-1 pr-2">{f.nombre}</td>
                    <td className="value py-1 pr-2 text-right">
                      {num(f.cantidad)} {f.unidad}
                    </td>
                    <td className="value py-1 pr-2 text-right text-ui-ink-muted">
                      {soles(f.precio)}/{f.unidad}
                    </td>
                    <td className="value py-1 text-right">{soles(f.costo)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5" colSpan={3}>
                    Total gastado
                  </td>
                  <td className="value py-1.5 text-right">{soles(rep.costoTotal)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-ui-ink-muted">
              <VARIABLE_CLIMA.lluvia className="shrink-0 text-sm text-serie-agua" />
              Agua: {rep.riego.eventos} riego(s) ·{' '}
              <span className="value text-ui-ink">{rep.riego.horas} h</span> de riego ({num(rep.riego.litros)}{' '}
              L).
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold">Venta</h3>
            <p className="text-ui-ink-muted">
              {rep.produccionKg} kg × {soles(rep.precioVenta)}/kg ={' '}
              <span className="value font-semibold text-ui-ink">{soles(rep.ingreso)}</span> · rendimiento{' '}
              {rep.rendimientoTHa} t/ha · salud media {rep.saludMedia}.
            </p>
            <p className="mt-1 text-ui-ink-muted">
              En {rep.diaCosecha - rep.diaInicio} días se gastaron{' '}
              <span className="value text-ui-ink">{soles(rep.costoTotal)}</span> y al cosechar y vender se
              recuperaron <span className="value text-ui-ink">{soles(rep.ingreso)}</span>.
            </p>
          </section>

          <section className="rounded-md border border-ui-border p-3">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold">
              <IconDescansar /> ¿Y ahora el suelo?
            </h3>
            <p className="mb-2 text-ui-ink-muted">
              {reco.motivo} ({ETIQUETA_DEMANDA[reco.demanda]}).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-2xs font-semibold text-ui-ink-muted uppercase">Opción 1 · Descanso</p>
                <button
                  className="btn btn-active w-full justify-center py-2"
                  disabled={reco.diasDescanso === 0}
                  onClick={() => harvest.descansar(rep.id)}
                >
                  <IconDescansar />
                  {reco.diasDescanso > 0
                    ? `Dejar descansar ${reco.diasDescanso} días`
                    : 'No necesita descanso'}
                </button>
              </div>
              <div>
                <p className="mb-1 text-2xs font-semibold text-ui-ink-muted uppercase">
                  Opción 2 · Cultivar algo con menos demanda
                </p>
                {reco.alternativas.length ? (
                  <ul className="space-y-1">
                    {reco.alternativas.slice(0, 3).map((a) => (
                      <li key={a.cultivo}>
                        <button
                          className="w-full rounded-md border border-ui-border px-2 py-1.5 text-left hover:bg-ui-panel-2"
                          onClick={() => harvest.rotar(rep.id, a.cultivo)}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <CropIcon nombre={a.cultivo} /> {a.cultivo}
                            <span
                              className={`ml-auto text-2xs ${a.alcanzaN ? 'text-chi-saludable' : 'text-chi-estresado'}`}
                            >
                              {a.alcanzaN ? 'N suficiente' : `requiere N ≥ ${a.nMinimo}`}
                            </span>
                          </span>
                          <span className="text-2xs text-ui-ink-muted">{a.motivo}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-2xs text-ui-ink-muted">
                    No hay cultivos de menor demanda aptos para este suelo.
                  </p>
                )}
              </div>
            </div>
          </section>

          <p className="text-2xs text-ui-ink-muted">
            Precios y dosis por m² son supuestos de simulación (src/domain/economy/insumos.ts).
          </p>
        </div>
      </div>
    </div>
  );
}
