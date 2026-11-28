/** Resting atomic classes read back: each class's style prop, token and breakpoint (`undefined` for the base rule). */
export interface ClassMap {
  readonly byClass: ReadonlyMap<
    string,
    { readonly prop: string; readonly token: string; readonly bp: string | undefined }
  >;
  /** Breakpoint names in token order with their `min-width` in px. */
  readonly breakpoints: readonly (readonly [string, number])[];
}
