import type { Raw } from "./Raw.ts";

/** One session of an engine: a statement with text parameters, and statements without parameters (a migration). */
export type Conn = {
  query(text: string, params: readonly (string | null)[]): Promise<Raw>;
  exec(text: string): Promise<void>;
};
