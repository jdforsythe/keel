import { inspectors } from "./inspectors.ts";

/**
 * Mark every registered inspector section as carried over (k.cli Inspector hooks). The `keel dev` server module calls
 * it each time it is evaluated, before it loads the app's modules: a module evaluated again registers its section
 * in place of the carried one, a module left as it was keeps its section, and two registrations of one id within
 * one load still throw E1057.
 */
export function inspectorsReload(): void {
  for (const [id, entry] of inspectors) inspectors.set(id, { ...entry, carried: true });
}
