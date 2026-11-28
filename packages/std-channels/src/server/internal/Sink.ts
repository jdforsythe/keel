/** One open member stream in a hub: its channel instance `key`, who it counts as, its serving `module`, and how events reach it. */
export interface Sink {
  readonly key: string;
  /** Who the caps count it as: `user:<id>` for a signed-in stream, else its caller (`""`: anonymous). */
  readonly caller: string;
  /** The module whose channel route opened it: that module's bounds count it. */
  readonly module: string;
  /** A message published to the sink's instance, already parsed by the channel's `message` schema. */
  post(message: unknown): void;
  /**
   * A save reported on the server ctx; `read` reads a stored snapshot once per save across sinks, `undefined` when not
   * settled within 5,000 ms on `ctx.clock`.
   */
  saved(store: string, head: number, read: (key: string) => Promise<string | null | undefined>): void;
}
