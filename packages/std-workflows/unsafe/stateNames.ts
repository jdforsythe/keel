import { unsafe } from "./unsafe.ts";

/** The state names of a chart's `states`, typed as its state type `S`. */
export function stateNames<S extends string>(states: Readonly<Record<S, unknown>>): S[] {
  return unsafe(
    "Object.keys of a chart's states record lists exactly the S keys chart() was given, a relation no check can prove",
    () => Object.keys(states).filter((n): n is S => n in states),
  );
}
