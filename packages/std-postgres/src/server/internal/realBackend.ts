import type { Backend } from "./Backend.ts";
import type { Engine } from "./Engine.ts";
import type { Migration } from "./Migration.ts";
import { engineFor } from "./engineFor.ts";
import { migrate } from "./migrate.ts";
import { reloadTypes } from "./reloadTypes.ts";

/** The URL and capability pairs whose migrations this process has applied or found applied. */
const migrated = new Map<string, Promise<void>>();

/**
 * The real (and shell) side's backend: `KEEL_POSTGRES_URL`, read at the first query on the ctx, picks the engine;
 * migrations are applied once per URL and capability per process. After a failed pass every query on this ctx rejects
 * with its error; the next ctx tries again.
 */
export function realBackend(name: string, files: readonly Migration[]): Backend {
  let url: string | undefined;
  let read = false;
  let failed: { readonly error: unknown } | undefined;
  return {
    pooled: true,
    prelude: async () => {},
    async ensure(): Promise<Engine> {
      if (failed !== undefined) throw failed.error;
      if (!read) {
        url = process.env.KEEL_POSTGRES_URL;
        read = true;
      }
      const engine = await engineFor(url);
      const key = `${url ?? ""}\u0000${name}`;
      let done = migrated.get(key);
      if (done === undefined) {
        done = migrate(engine, name, files, async () => {}).then(async (ran) => {
          if (ran) await reloadTypes(engine);
        });
        migrated.set(key, done);
        done.catch(() => migrated.delete(key));
      }
      await done.catch((error: unknown) => {
        failed = { error };
        throw error;
      });
      return engine;
    },
  };
}
