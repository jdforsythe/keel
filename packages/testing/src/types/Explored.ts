/**
 * The result of `explore` (k.model), JSON: every distinct state visited, the start first, in visiting order; the
 * edges run; the longest shortest path; whether no state was left unexpanded; the expanded states from which every
 * edge returned the same state or an error.
 */
export interface Explored<T> {
  readonly states: readonly T[];
  readonly edges: number;
  readonly depth: number;
  readonly complete: boolean;
  readonly terminal: readonly T[];
}
