import type { Sink } from "./Sink.ts";
import type { StoreWatch } from "./StoreWatch.ts";

/** The open streams of one server ctx, the stop of its `save` observer while any is open, and its one storage watch while a stream holds it. */
export interface Hub {
  readonly sinks: Set<Sink>;
  stop: (() => void) | undefined;
  watch: StoreWatch | undefined;
}
