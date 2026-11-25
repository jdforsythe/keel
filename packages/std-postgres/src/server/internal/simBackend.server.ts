import { attempt } from "@keel/schema";
import type { Backend } from "./Backend.ts";
import type { Engine } from "./Engine.ts";
import type { Held } from "./Held.ts";
import type { Migration } from "./Migration.ts";
import { localChanges } from "./localChanges.server.ts";
import { migrate } from "./migrate.server.ts";
import { reloadTypes } from "./reloadTypes.server.ts";
import { seedValue } from "./seedValue.server.ts";
import { simEngine } from "./simEngine.server.ts";

let schemas = 0;

/**
 * The sim side's backend: the shared PGlite in memory, a schema of its own per sim ctx and capability, migrated at the
 * first call; a failed pass keeps nothing and the next call runs it again. Its changes are delivered to its own follows. Each
 * transaction sets that `search_path` and `setseed` from the capability seed and the call count. Each call into PGlite is
 * held under `<name> query`, and the engine's boot under `<name> boot` (its wait for the session, a plan step's delay and a transaction body's own awaits are not).
 */
export function simBackend(
  name: string,
  files: () => readonly Migration[],
  seed: number,
  hold: <T>(label: string, start: () => Promise<T>) => Promise<T>,
): Backend {
  const held: Held = (start) => hold(`${name} query`, start);
  schemas += 1;
  const schema = `keel_sim_${schemas}`;
  let calls = 0;
  let made: Promise<Engine> | undefined;
  const changes = localChanges();
  const prelude: Backend["prelude"] = async (c) => {
    calls += 1;
    await c.query(`set local search_path to ${schema}`, []);
    await c.query("select setseed($1)", [String(seedValue(seed, calls))]);
  };
  return {
    pooled: false,
    prelude,
    changes: () => changes,
    ensure(): Promise<Engine> {
      if (made !== undefined) return made;
      const making = (async () => {
        const shared = await hold(`${name} boot`, simEngine);
        // Every call into the shared PGlite goes through `held`, a migration's included (k.drive).
        const engine: Engine = {
          types: shared.types,
          statement: (text, params) => shared.statement(text, params, held),
          tx: (level, fn) => shared.tx(level, fn, held),
        };
        await engine.tx("read committed", async (c) => {
          await c.exec(`create schema if not exists ${schema}`);
          return { value: null, commit: true };
        });
        if (
          await migrate(engine, name, files(), async (c) => {
            await c.query(`set local search_path to ${schema}`, []);
          })
        )
          await reloadTypes(engine);
        return engine;
      })();
      made = making;
      void attempt(() => making).then((r) => {
        if (!r.ok && made === making) made = undefined;
      });
      return making;
    },
  };
}
