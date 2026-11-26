import type { Store } from "@keel/store";
import type { LogRecord } from "./LogRecord.ts";
import type { OpenOptions } from "./OpenOptions.ts";
import type { Page } from "./Page.ts";
import type { Wait } from "./Wait.ts";

/** The running deployables of one `serve` (k.e2e Served). */
export interface Served {
  /** A deployable's origin; default the first deployable of `topology.ts` that serves documents. */
  origin(deployable?: string): string;
  open(path: string, options?: OpenOptions): Promise<Page>;
  /** A request from the test process: no cookie sent, no redirect followed. */
  fetch(path: string, init?: RequestInit & { readonly deployable?: string }): Promise<Response>;
  /** Every record the deployable's process wrote, in order. */
  serverLog(deployable?: string): readonly LogRecord[];
  /** A server store's value as the deployable's storage holds it. */
  state<T>(store: Store<T>): Promise<T>;
  until<T>(store: Store<T>, test: (value: T) => boolean, wait?: Wait): Promise<T>;
  /** SIGKILL; every deployable when none is named. */
  stop(deployable?: string): Promise<void>;
  /** A stopped deployable again, on its port and data. */
  start(deployable?: string): Promise<void>;
  dispose(): Promise<void>;
}
