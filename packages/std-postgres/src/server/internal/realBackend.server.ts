import type { Backend } from "./Backend.ts";
import type { Changes } from "./Changes.ts";
import type { Engine } from "./Engine.ts";
import type { Migration } from "./Migration.ts";
import { engineFor } from "./engineFor.server.ts";
import { forgetting } from "./forgetting.server.ts";
import { listenChanges } from "./listenChanges.server.ts";
import { migrate } from "./migrate.server.ts";
import { pgliteChanges } from "./pgliteChanges.server.ts";
import { postgresUrl } from "./postgresUrl.server.ts";
import { reloadTypes } from "./reloadTypes.server.ts";
import { schemeOf } from "./schemeOf.server.ts";

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
        const running: Promise<void> = forgetting(
          () =>
            migrate(engine, name, files(), async () => {}).then(async (ran) => {
              if (ran) await reloadTypes(engine);
            }),
          () => {
            if (migrated.get(key) === running) migrated.delete(key);
          },
        );
        done = running;
        migrated.set(key, running);
      }
      await done;
      return engine;
    },
  };
}
