import type { Backend } from "./Backend.ts";
import type { Engine } from "./Engine.ts";
import type { Migration } from "./Migration.ts";
import { migrate } from "./migrate.ts";
import { reloadTypes } from "./reloadTypes.ts";
import { seedValue } from "./seedValue.ts";
import { simEngine } from "./simEngine.ts";

let schemas = 0;

/**
 * The sim side's backend: the shared PGlite in memory, a schema of its own per sim ctx and capability, migrated at the
 * first call; a failed pass keeps nothing and the next call runs it again. Each transaction sets that `search_path` and `setseed` from the capability seed and the call count.
 */
export function simBackend(name: string, files: () => readonly Migration[], seed: number): Backend {
  schemas += 1;
  const schema = `keel_sim_${schemas}`;
  let calls = 0;
  let made: Promise<Engine> | undefined;
  const prelude: Backend["prelude"] = async (c) => {
    calls += 1;
    await c.query(`set local search_path to ${schema}`, []);
    await c.query("select setseed($1)", [String(seedValue(seed, calls))]);
  };
  return {
    pooled: false,
    prelude,
    ensure(): Promise<Engine> {
      if (made !== undefined) return made;
      const making = (async () => {
        const engine = await simEngine();
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
      making.catch(() => {
        if (made === making) made = undefined;
      });
      return making;
    },
  };
}
