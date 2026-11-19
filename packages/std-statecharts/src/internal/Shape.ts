/** A name as written, with where it was written (`P`: a source span for the checker, nothing for `chart`). */
type Named<P> = { readonly name: string; readonly at: P };

/**
 * A chart declaration as the one structural analysis reads it. `events`, `guards` and `actions` are absent when their
 * names are unknown (not literals), so the names cannot be checked against them.
 */
export type Shape<P> = {
  readonly initial: Named<P>;
  readonly states: readonly {
    readonly name: string;
    readonly at: P;
    readonly final: boolean;
    readonly hasOn: boolean;
    readonly on: readonly {
      readonly event: Named<P>;
      readonly targets: readonly { readonly to?: Named<P>; readonly guard?: Named<P>; readonly do?: Named<P> }[];
    }[];
  }[];
  readonly events?: readonly string[];
  readonly guards?: readonly string[];
  readonly actions?: readonly string[];
};
