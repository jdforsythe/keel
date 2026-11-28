import type { Changes } from "./Changes.ts";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";

/**
 * How one ctx's database reaches its engine. `ensure` makes it ready (the engine, a sim schema, the migrations) and
 * resolves the engine; `prelude` runs first in each of its transactions; `pooled` says a statement may run outside
 * a transaction (real) rather than in one with the prelude (sim); `changes` is where its changes are followed.
 */
export type Backend = {
  ensure(): Promise<Engine>;
  prelude(c: Conn): Promise<void>;
  readonly pooled: boolean;
  changes(): Changes;
};
