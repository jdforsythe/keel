/** Handle to a side effect; `dispose()` unsubscribes it. */
export interface Effect {
  dispose(): void;
}
