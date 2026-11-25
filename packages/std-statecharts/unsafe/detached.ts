import { scope } from "@keel/reactive";
import type { Schema } from "@keel/schema";
import type { ChartInstance } from "../src/ChartInstance.ts";
import { unsafe } from "./unsafe.ts";

/**
 * Compiles a chart declared at module level, outside every scope, to its store `id` in a scope no owner disposes
 * (k.reactive E1207): `compile` is the chart's own, which creates the chart's store and its transactions and nothing
 * else.
 */
export function detached<D, Ev extends Readonly<Record<string, Schema<unknown>>>, S extends string>(
  compile: (id: string) => ChartInstance<D, Ev, S>,
  id: string,
): ChartInstance<D, Ev, S> {
  return unsafe(
    "a chart declared at module level owns its store for the module's whole life, as a module-level store does, so its scope has no owner to nest in and none disposes it",
    () => scope(() => undefined, { detached: true }).run(() => compile(id)),
  );
}
