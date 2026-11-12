import type { Sink } from "./Sink.ts";

/** The open streams of one server ctx, and the stop of its `save` observer while any is open. */
export interface Hub {
  readonly sinks: Set<Sink>;
  stop: (() => void) | undefined;
}
