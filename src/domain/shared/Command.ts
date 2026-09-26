/** Patrón Command: toda mutación del estado agronómico pasa por un comando (docs/02, 03, 09). */
export interface Command<TState> {
  readonly name: string;
  /** Devuelve `true` o el motivo por el que no puede ejecutarse (se muestra al usuario). */
  canExecute(state: TState): true | string;
  execute(state: TState): TState;
}
