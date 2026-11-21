/**
 * One problem the static read of `topology.ts` finds: code, deployable (`""` for the whole file), a one-line message,
 * and, when known, the offset in the source it is at and a replacement `[start, end)` that repairs it.
 */
export type TopologyProblem = [
  code: string,
  deployable: string,
  message: string,
  at?: number,
  fix?: { readonly start: number; readonly end: number; readonly text: string },
];
