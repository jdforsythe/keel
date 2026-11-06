import type { Signal } from "@keel/reactive";

/** The nearest Boundary as seen by code under it. */
export interface Catcher {
  /** The boundary's state signal: every effect that may report here declares it in `writes`. */
  readonly state: Signal<unknown>;
  /** Dispose the boundary's children now and render its fallback for `error` surfaced at element `at`. */
  fail(error: unknown, at: string): void;
}
