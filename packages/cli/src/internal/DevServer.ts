/** The part of the project's Vite dev server `keel dev` drives, narrowed at runtime from what `createServer` returns. */
export type DevServer = {
  /** The project's Vite version. */
  readonly version: string;
  /** `config.server.port` as Vite resolved it: the given port, the config's `server.port`, or Vite's default. */
  readonly port: unknown;
  /** `config.server.host` as Vite resolved it: `--host` when given, else the config's own, else undefined. */
  readonly host: unknown;
  listen(): Promise<unknown>;
  /** Listens on `127.0.0.1:<port>` too, with the same request and upgrade handlers, and closes with the server. */
  loopback(port: number): Promise<void>;
  close(): Promise<unknown>;
  printUrls(): void;
  /** Writes a line through Vite's logger. */
  info(message: string): void;
  /** Vite's terminal shortcuts (a no-op when the server has none or stdin is not a TTY). */
  shortcuts(): void;
  /** Calls `listener` with the event (`add`, `change`, `unlink`, ...) and absolute path of each change its watcher sees. */
  onChange(listener: (event: string, file: string) => void): void;
  /** Adds files to its watcher (a linked package's, outside the root). */
  watch(files: readonly string[]): void;
};
