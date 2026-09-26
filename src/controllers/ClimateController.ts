/**
 * Escenarios climáticos (selección y comparativa) y sandbox de datos climáticos
 * personalizables (crear, editar, duplicar, eliminar, importar y exportar).
 */
import { CustomScenarioStorage, type EscenarioGuardado } from '@/data/customScenarioStorage';
import type { ClimaMes } from '@/data/types';
import {
  ClimateScenarioFactory,
  MODIFICADORES_NEUTROS,
  ScenarioBuilder,
  ScenarioCodec,
  type CampoClima,
  type Modificadores,
} from '@/domain/climate';
import { CycleBalance, type BalanceCiclo } from '@/domain/simulation';
import type { BorradorClima, VistaClima } from '@/store/useSimStore';
import { BaseController } from './BaseController';

export class ClimateController extends BaseController {
  // ---------- Panel

  open(vistaClima: VistaClima = 'escenarios'): void {
    this.set({ vistaClima, erroresClima: [] });
  }

  close(): void {
    this.set({ vistaClima: null, erroresClima: [] });
  }

  // ---------- Selección y comparativa

  select(escenario: string): void {
    if (!this.deps.scenarios.existe(escenario)) return this.notify('error', `No existe "${escenario}".`);
    this.set({ escenario });
    this.notify('ok', `Escenario climático activo: ${escenario}. Se aplica desde el próximo día simulado.`);
  }

  setCultivoComparacion(cultivoComparacion: string): void {
    this.set({ cultivoComparacion });
  }

  /** Balance hídrico del ciclo del cultivo en cada escenario (reales y personalizados). */
  comparar(cultivo: string = this.state.cultivoComparacion): BalanceCiclo[] {
    const crop = this.deps.crops.find(cultivo);
    return crop ? this.deps.scenarios.all().map((e) => CycleBalance.calcular(crop, e)) : [];
  }

  // ---------- Sandbox: borrador

  /** Nuevo escenario a partir de uno existente (real o personalizado). */
  startDraft(base: string = this.state.escenario): void {
    const nombre = this.nombreLibre(`${base} (mod.)`);
    this.set({
      vistaClima: 'sandbox',
      erroresClima: [],
      borrador: { nombre, base, modificadores: { ...MODIFICADORES_NEUTROS }, ediciones: {}, editando: null },
    });
  }

  /** Edita un personalizado existente: parte de sus valores actuales. */
  edit(nombre: string): void {
    if (this.deps.scenarios.esReal(nombre)) return this.startDraft(nombre);
    this.set({
      vistaClima: 'sandbox',
      erroresClima: [],
      borrador: {
        nombre,
        base: nombre,
        modificadores: { ...MODIFICADORES_NEUTROS },
        ediciones: {},
        editando: nombre,
      },
    });
  }

  private patchDraft(cambios: Partial<BorradorClima>): void {
    const b = this.state.borrador;
    if (b) this.set({ borrador: { ...b, ...cambios }, erroresClima: [] });
  }

  setNombre(nombre: string): void {
    this.patchDraft({ nombre });
  }

  setBase(base: string): void {
    this.patchDraft({ base, ediciones: {} });
  }

  setModificadores(m: Partial<Modificadores>): void {
    const b = this.state.borrador;
    if (b) this.patchDraft({ modificadores: { ...b.modificadores, ...m } });
  }

  /** Fija un valor mensual a mano; `null` lo devuelve al valor calculado. */
  setValor(mes: number, campo: CampoClima, valor: number | null): void {
    const b = this.state.borrador;
    if (!b) return;
    const delMes = { ...(b.ediciones[mes] ?? {}) };
    if (valor === null || Number.isNaN(valor)) delete delMes[campo];
    else delMes[campo] = valor;
    this.patchDraft({ ediciones: { ...b.ediciones, [mes]: delMes } });
  }

  resetDraft(): void {
    this.patchDraft({ modificadores: { ...MODIFICADORES_NEUTROS }, ediciones: {} });
  }

  cancelDraft(): void {
    this.set({ borrador: null, vistaClima: 'escenarios', erroresClima: [] });
  }

  /** Meses resultantes del borrador (vista previa). */
  preview(borrador: BorradorClima | null = this.state.borrador): ClimaMes[] {
    if (!borrador || !this.deps.scenarios.existe(borrador.base)) return [];
    return ScenarioBuilder.from(this.deps.scenarios.create(borrador.base))
      .withModificadores(borrador.modificadores)
      .withEdiciones(borrador.ediciones)
      .build();
  }

  validarBorrador(borrador: BorradorClima | null = this.state.borrador): string[] {
    if (!borrador) return [];
    const errores = ClimateScenarioFactory.validar(this.preview(borrador));
    const nombre = borrador.nombre.trim();
    if (!nombre) errores.unshift('Escribe un nombre para el escenario.');
    else if (this.deps.scenarios.esReal(nombre))
      errores.unshift(`"${nombre}" es un escenario real: usa otro nombre.`);
    else if (nombre !== borrador.editando && this.deps.scenarios.existe(nombre)) {
      errores.unshift(`Ya existe un escenario llamado "${nombre}".`);
    }
    return errores;
  }

  /** Guarda el borrador como escenario personalizado y, si se pide, lo activa. */
  saveDraft(activar = true): void {
    const b = this.state.borrador;
    if (!b) return;
    const errores = this.validarBorrador(b);
    if (errores.length) return this.set({ erroresClima: errores });

    const nombre = b.nombre.trim();
    const meses = this.preview(b);
    const baseReal = this.baseReal(b.base);
    this.deps.scenarios.custom(nombre, meses, baseReal);
    if (b.editando && b.editando !== nombre) this.deps.scenarios.remove(b.editando);

    const otros = this.state.personalizados.filter((p) => p.nombre !== nombre && p.nombre !== b.editando);
    this.persist([...otros, { nombre, base: baseReal, meses }]);
    const renombrado = b.editando && this.state.escenario === b.editando;
    this.set({
      borrador: null,
      vistaClima: 'escenarios',
      escenario: activar || renombrado ? nombre : this.state.escenario,
    });
    this.notify('ok', `Escenario "${nombre}" guardado${activar ? ' y activado' : ''}.`);
  }

  // ---------- Gestión de personalizados

  remove(nombre: string): void {
    if (!this.deps.scenarios.remove(nombre)) return;
    this.persist(this.state.personalizados.filter((p) => p.nombre !== nombre));
    if (this.state.escenario === nombre) this.set({ escenario: this.deps.scenarios.reales()[0] });
    this.notify('ok', `Escenario "${nombre}" eliminado.`);
  }

  /** Importa escenarios en formato clima_escenarios; los inválidos se reportan sin romper nada. */
  importar(texto: string): void {
    const importados = ScenarioCodec.parse(texto);
    const errores: string[] = [];
    const nuevos: EscenarioGuardado[] = [];

    for (const imp of importados) {
      if (imp.errores.length) {
        errores.push(`${imp.nombre}: ${imp.errores.slice(0, 3).join(' ')}`);
        continue;
      }
      const nombre = this.nombreLibre(imp.nombre);
      this.deps.scenarios.custom(nombre, imp.meses);
      nuevos.push({ nombre, base: null, meses: imp.meses });
    }

    if (nuevos.length) this.persist([...this.state.personalizados, ...nuevos]);
    this.set({ erroresClima: errores });
    if (nuevos.length) {
      this.notify(
        'ok',
        `Importados: ${nuevos.map((n) => n.nombre).join(', ')}.`,
        errores.length ? errores : undefined,
      );
    } else {
      this.notify('error', 'No se importó ningún escenario válido.', errores);
    }
  }

  /** JSON en formato clima_escenarios de los escenarios indicados. */
  exportar(nombres: readonly string[]): string {
    return ScenarioCodec.stringify(nombres.map((n) => this.deps.scenarios.create(n)));
  }

  // ---------- Utilidades

  private persist(personalizados: EscenarioGuardado[]): void {
    this.set({ personalizados });
    CustomScenarioStorage.save(personalizados);
  }

  private baseReal(nombre: string): string | null {
    if (this.deps.scenarios.esReal(nombre)) return nombre;
    return this.deps.scenarios.existe(nombre) ? this.deps.scenarios.create(nombre).base : null;
  }

  /** "Nombre", o "Nombre 2", "Nombre 3"… si ya existe. */
  private nombreLibre(deseado: string): string {
    let nombre = deseado.trim() || 'Personalizado';
    for (let i = 2; this.deps.scenarios.existe(nombre); i++) nombre = `${deseado} ${i}`;
    return nombre;
  }
}
