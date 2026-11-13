import { unsafe } from "./unsafe.ts";

/**
 * A chart's guards (`R` boolean) or actions (`R` the data) as functions of any payload. Each is typed with every
 * event's payload fields at once and called with the payload of the event whose target names it.
 */
export function loosen<D, R>(
  fns: Readonly<Record<string, (data: D, payload: never) => R>> | undefined,
): Readonly<Record<string, (data: D, payload: unknown) => R>> {
  return unsafe(
    "a target's guard and do names are checked against guards and actions, but not the payload fields they read",
    () => (fns ?? {}) as Readonly<Record<string, (data: D, payload: unknown) => R>>,
  );
}
