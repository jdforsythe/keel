/** One open member stream in a hub: its channel instance `key`, its `caller`, its serving `module`, and how events reach it. */
export interface Sink {
  readonly key: string;
  readonly caller: string;
  /** The module whose channel route opened it: that module's bounds count it. */
  readonly module: string;
  /** A message published to the sink's instance, already parsed by the channel's `message` schema. */
  post(message: unknown): void;
  /** A save reported on the server ctx; `read` reads a stored snapshot once per save across sinks. */
  saved(store: string, head: number, read: (key: string) => Promise<string | null>): void;
}
