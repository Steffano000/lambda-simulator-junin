/**
 * Pasos 4–7 del flujo · Validación de prerrequisitos, acceso a cultivos, corrección
 * del terreno (flujo alternativo), plantación, cosecha y remoción.
 */
import type { ToolId, ValidacionSiembra } from '@/domain/actions';
import type { Crop } from '@/domain/crops';
import type { TileNode } from '@/domain/grid';
import type { ClimaHoy, DetalleCultivo } from '@/domain/plantation';
import { BaseController } from './BaseController';

export class PlantingController extends BaseController {
  /** Cultivos cuya textura preferida coincide con el terreno. */
  aptos(): Crop[] {
    const t = this.state.terreno;
    return t ? this.deps.crops.all().filter((c) => c.texturaCompatible(t.textura)) : [];
  }

  noAptos(): Crop[] {
    const t = this.state.terreno;
    return t ? this.deps.crops.all().filter((c) => !c.texturaCompatible(t.textura)) : [];
  }

  selectCrop(cultivo: string | null): void {
    this.set({ cultivo });
  }

  /** Detalle del cultivo de una celda (null si la celda no tiene cultivo). */
  detalleCultivo(tile: TileNode, hoy: ClimaHoy): DetalleCultivo | null {
    const crop = this.deps.crops.find(tile.vegetacionId);
    if (!crop) return null;
    const s = this.state;
    const plantacion =
      s.plantaciones.find((p) => p.cultivo === crop.nombre && p.tileIds.includes(tile.id)) ?? null;
    const saturacion = this.deps.hidraulica(tile.suelo.clase)?.saturacionPct ?? 100;
    return this.deps.cropInspector.detalle(tile, crop, hoy, saturacion, plantacion, s.dia);
  }

  /** Muestra u oculta la vista previa del cultivo sobre las celdas listas. */
  togglePrevia(): void {
    this.set({ previaCultivo: !this.state.previaCultivo });
  }

  /** Celdas candidatas a sembrar: la selección o, sin selección, las celdas tratadas (aradas). */
  candidatas(): TileNode[] {
    const s = this.state;
    return s.seleccion.length
      ? this.objetivo()
      : s.tiles.filter((t) => t.estado === 'arado' && !t.vegetacionId);
  }

  validar(cultivo: string, tiles: readonly TileNode[] = this.candidatas()): ValidacionSiembra {
    return this.deps.validator.validar(this.deps.crops.create(cultivo), tiles, this.context());
  }

  /** Planta en las celdas listas; las que no cumplen quedan intactas y se informan. */
  plant(): void {
    const s = this.state;
    if (!s.cultivo) return this.notify('error', 'Selecciona un cultivo.');
    const v = this.validar(s.cultivo);
    if (v.bloqueosCultivo.length)
      return this.notify('error', 'No se puede sembrar ahora.', v.bloqueosCultivo);
    if (v.listas.length === 0) {
      return this.notify('error', 'Ninguna celda cumple los requisitos. Usa "Corregir" para tratarlas.');
    }

    const r = this.deps.actions.executeMany('sembrar', v.listas, s.tiles, this.context());
    const porId = this.tilesById(r.tiles);
    const plantacion = this.deps.plantations.crear(s.cultivo, r.aplicadas, s.dia, porId);
    this.set({
      tiles: r.tiles,
      plantaciones: [...s.plantaciones, plantacion],
      seleccion: [],
      correccion: null,
    });
    this.registrar('sembrar', r.aplicadas, s.cultivo);
    const faltan = v.aCorregir.length
      ? [`${v.aCorregir.length} celda(s) requieren tratamiento antes de sembrar.`]
      : [];
    this.notify(
      'ok',
      `${s.cultivo} plantado en ${r.aplicadas.length} celda(s) (plantación ${plantacion.id}).`,
      faltan,
    );
  }

  /** Flujo alternativo: vuelve a tratamientos con las celdas que no cumplen seleccionadas. */
  correct(): void {
    const s = this.state;
    if (!s.cultivo) return;
    const v = this.validar(s.cultivo);
    if (v.aCorregir.length === 0) return this.notify('ok', 'Todas las celdas cumplen los requisitos.');
    const primera = v.pendientes[0]?.herramientas[0] ?? null;
    this.set({
      fase: 'tratamiento',
      correccion: { cultivo: s.cultivo, tileIds: v.aCorregir },
      seleccion: v.pendientes[0]?.tileIds ?? v.aCorregir,
      herramienta: primera,
    });
    this.notify('ok', `Corrige ${v.aCorregir.length} celda(s) para ${s.cultivo} y vuelve a cultivos.`);
  }

  /** Selecciona las celdas de un requisito pendiente y sugiere su tratamiento. */
  focusPendiente(tileIds: string[], herramienta: ToolId | null): void {
    this.set({ seleccion: tileIds, herramienta });
  }

  /** Termina la corrección y regresa a la selección del cultivo. */
  backToCrops(): void {
    const c = this.state.correccion;
    this.set({
      fase: 'cultivos',
      cultivo: c?.cultivo ?? this.state.cultivo,
      seleccion: c?.tileIds ?? [],
      correccion: null,
    });
  }

  cancelCorrection(): void {
    this.set({ correccion: null });
  }

  remove(plantacionId: string): void {
    const s = this.state;
    const p = s.plantaciones.find((x) => x.id === plantacionId);
    if (!p) return;
    const ids = this.deps.plantations.activas(p, this.tilesById()).map((t) => t.id);
    const r = this.deps.actions.executeMany('remover', ids, s.tiles, this.context());
    this.set({ tiles: r.tiles });
    this.registrar('remover', r.aplicadas, p.cultivo);
    this.notify('ok', `Plantación ${p.id} removida (${r.aplicadas.length} celdas quedan baldías).`);
  }

  selectPlantation(plantacionId: string): void {
    const p = this.state.plantaciones.find((x) => x.id === plantacionId);
    if (p) this.set({ seleccion: this.deps.plantations.activas(p, this.tilesById()).map((t) => t.id) });
  }
}
