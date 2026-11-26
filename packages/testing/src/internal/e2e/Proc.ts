import type { LogRecord } from "../../types/LogRecord.ts";

/** A deployable's process (or `keel dev`) as one `serve` runs it, across its stops and starts. */
export type Proc = {
  readonly name: string;
  /** Every record it wrote, in order, over all its runs. */
  readonly log: LogRecord[];
  port(): number;
  running(): boolean;
  /** Starts it and resolves once it answers; rejects with the cause when it exits or never answers. */
  start(): Promise<void>;
  /** SIGKILL; resolves once it has exited. */
  kill(): Promise<void>;
};
