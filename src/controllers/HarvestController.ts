/**
 * Fase final · Cosecha: recolección de las celdas maduras, informe de lo gastado y lo
 * recuperado, y qué hacer con el suelo después (descanso o rotación de cultivo).
 */
import { HarvestReport, type ReporteCosecha } from '@/domain/economy';
import { BaseController } from './BaseController';

export class HarvestController extends BaseController {
  goToHarvest(): void {
    if (this.state.plantaciones.length === 0) {
      return this.notify('error', 'Todavía no hay plantaciones que cosechar.');
    }
    this.set({ fase: 'cosecha', mensaje: null, correccion: null });
  }

  /** Cosecha las celdas maduras de la plantación y abre su informe de recolección. */
  harvest(plantacionId: string): void {
    const s = this.state;
    const p = s.plantaciones.find((x) => x.id === plantacionId);
    const crop = this.deps.crops.find(p?.cultivo ?? null);
    if (!p || !crop) return;
    const maduras = this.deps.plantations
      .activas(p, this.tilesById())
      .filter((t) => t.estado === 'maduro' && t.salud > 0)
      .map((t) => t.id);
    if (!maduras.length) return this.notify('error', `La plantación ${p.id} aún no tiene celdas maduras.`);

    const r = this.deps.actions.executeMany('cosechar', maduras, s.tiles, this.context());
    this.set({ tiles: r.tiles });
    this.registrar('cosechar', r.aplicadas, p.cultivo);

    const cosechadas = new Set(r.aplicadas);
    const reporte = HarvestReport.generar({
      id: `R${this.state.reportes.length + 1}`,
      plantacion: p,
      crop,
      cosechas: r.cosechas,
      diaCosecha: s.dia,
      bitacora: this.state.bitacora,
      tilesDespues: r.tiles.filter((t) => cosechadas.has(t.id)),
      candidatos: this.deps.crops.all(),
      textura: s.terreno?.textura,
    });

    this.set({
      cosechas: [...r.cosechas, ...s.cosechas],
      plantaciones: s.plantaciones.map((x) =>
        x.id === p.id ? { ...x, cosechadoKg: x.cosechadoKg + reporte.produccionKg } : x,
      ),
      reportes: [...this.state.reportes, reporte],
      reporteAbierto: reporte.id,
      fase: 'cosecha',
    });
    this.notify(
      'ok',
      `Recolección completada: ${reporte.produccionKg} kg de ${p.cultivo} en ${reporte.areaM2} m².`,
    );
  }

  abrir(reporteId: string): void {
    this.set({ reporteAbierto: reporteId });
  }

  cerrar(): void {
    this.set({ reporteAbierto: null });
  }

  private reporte(reporteId: string): ReporteCosecha | undefined {
    return this.state.reportes.find((r) => r.id === reporteId);
  }

  /** Deja en descanso (barbecho) las celdas cosechadas durante los días recomendados. */
  descansar(reporteId: string): void {
    const rep = this.reporte(reporteId);
    if (!rep) return;
    const dias = rep.recomendacion.diasDescanso;
    if (dias <= 0) return this.notify('ok', 'Este suelo no necesita descanso: puedes volver a sembrar.');
    const s = this.state;
    const r = this.deps.actions.executeMany('descansar', rep.tileIds, s.tiles, {
      ...this.context(),
      diasDescanso: dias,
    });
    this.set({ tiles: r.tiles, reporteAbierto: null });
    this.registrar('descansar', r.aplicadas);
    this.notify(
      r.aplicadas.length ? 'ok' : 'error',
      r.aplicadas.length
        ? `${r.aplicadas.length} celda(s) en descanso hasta el día ${s.dia + dias}: recuperan N y materia orgánica.`
        : r.mensaje,
    );
  }

  /**
   * Rotación: prepara las mismas celdas para un cultivo que pide menos nutrientes
   * (vuelve a tratamientos con el área seleccionada y el cultivo elegido).
   */
  rotar(reporteId: string, cultivo: string): void {
    const rep = this.reporte(reporteId);
    if (!rep || !this.deps.crops.find(cultivo)) return;
    this.set({
      fase: 'tratamiento',
      seleccion: rep.tileIds,
      cultivo,
      herramienta: 'arar',
      reporteAbierto: null,
    });
    this.notify(
      'ok',
      `Rotación a ${cultivo}: ara el área seleccionada y luego pasa a Cultivos para sembrar.`,
    );
  }
}
