/** The part of the project's Vite dev server `keel dev` drives, narrowed at runtime from what `createServer` returns. */
export type DevServer = {
  /** The project's Vite version. */
  readonly version: string;
  /** `config.server.port` as Vite resolved it: the given port, the config's `server.port`, or Vite's default. */
  readonly port: unknown;
  listen(): Promise<unknown>;
  close(): Promise<unknown>;
  printUrls(): void;
  /** Writes a line through Vite's logger. */
  info(message: string): void;
  /** Vite's terminal shortcuts (a no-op when the server has none or stdin is not a TTY). */
  shortcuts(): void;
};
