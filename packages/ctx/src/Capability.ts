import type { Schema } from "@keel/schema";

/**
 * A capability's three implementations. Each factory runs once per ctx; `seed` derives from the ctx seed. `plan`, when
 * given, is the schema of one step of the capability's plan: the sim factory gets the schedule's `plans[name]`, each
 * step parsed by it (default `[]`), and `hold`. `P` types those steps.
 */
export interface Capability<T extends object, P = never> {
  readonly real: (opts: { readonly seed: number }) => T;
  readonly shell: (opts: { readonly seed: number }) => T;
  // Method syntax: the registry calls every sim factory with parsed steps typed `unknown`.
  sim(opts: {
    readonly seed: number;
    readonly plan: readonly P[];
    /** Calls `start` and marks the work it returns held until it settles: work that answers through something made outside the run (k.sim). */
    readonly hold: <W>(label: string, start: () => Promise<W>) => Promise<W>;
  }): T;
  readonly plan?: Schema<unknown, boolean>;
}
