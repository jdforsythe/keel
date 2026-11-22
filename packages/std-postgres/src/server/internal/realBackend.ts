import type { Backend } from "./Backend.ts";
import type { Changes } from "./Changes.ts";
import type { Engine } from "./Engine.ts";
import type { Migration } from "./Migration.ts";
import { engineFor, schemeOf } from "./engineFor.ts";
import { listenChanges } from "./listenChanges.ts";
import { migrate } from "./migrate.ts";
import { pgliteChanges } from "./pgliteChanges.ts";
import { postgresUrl } from "./postgresUrl.ts";
import { reloadTypes } from "./reloadTypes.ts";

/** The URL and capability pairs whose migrations this process has applied or found applied. */
const migrated = new Map<string, Promise<void>>();

/**
 * The real (and shell) side's backend: the URL (`postgresUrl`), read at the first query on the ctx, picks the engine;
 * migrations are applied once per URL and capability per process. A failed pass keeps nothing: the call that ran it
 * rejects, and the next call runs it again. Changes are followed on the same URL: by its listening connection on
 * Postgres, in process on a `pglite:` folder.
 */
export function realBackend(name: string, files: () => readonly Migration[]): Backend {
  let url: string | undefined;
  let read = false;
  const urlOf = (): string | undefined => {
    if (!read) {
      url = postgresUrl();
      read = true;
    }
    return url;
  };
  return {
    pooled: true,
    prelude: async () => {},
    changes(): Changes {
      const { url: at, scheme } = schemeOf(urlOf());
      return scheme === "pglite" ? pgliteChanges(at) : listenChanges(at);
    },
    async ensure(): Promise<Engine> {
      urlOf();
      const engine = await engineFor(url);
      const key = `${url ?? ""}\u0000${name}`;
      let done = migrated.get(key);
      if (done === undefined) {
        done = migrate(engine, name, files(), async () => {}).then(async (ran) => {
          if (ran) await reloadTypes(engine);
        });
        migrated.set(key, done);
        done.catch(() => migrated.delete(key));
      }
      await done;
      return engine;
    },
  };
}
