import { type Ctx, createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { isolate } from "../isolate.ts";
import { stores } from "../stores.ts";
import type { ChainLevel } from "./types/ChainLevel.ts";

const DEFAULT_ID = /^store\.\d+$/;

/**
 * E1550 (k.server Rules): in each route chain (`chains`, outermost level first), two different factories that create
 * one store id. Each factory runs once on `ctx` (default a sim ctx) in a detached, isolated scope, disposed after (as
 * `storeShapes`); its ids are those of the stores it created, up to a throw when it throws (a factory that creates one
 * id twice throws at the second); a default id (`store.<n>`) is not one. A message per pair of routes, at the deeper: `route <deeper>: stores: <its factory> and <other> (<route>)
 * both create store <id>; name one factory`. Two levels naming one factory share its store and are none.
 */
export function storeIdClashes(
  chains: readonly (readonly ChainLevel[])[],
  ctx: Ctx = createCtx({ mode: "sim" }),
): string[] {
  const ids = new Map<ChainLevel["factory"], ReadonlySet<string>>();
  const idsOf = (f: ChainLevel["factory"]): ReadonlySet<string> => {
    const known = ids.get(f);
    if (known !== undefined) return known;
    const sc = scope(() => undefined, { detached: true });
    isolate(sc);
    try {
      sc.run(() => f(ctx));
    } catch {
      // What it created before the throw is read below.
    }
    const found: ReadonlySet<string> = new Set([...sc.run(stores).keys()].filter((id) => !DEFAULT_ID.test(id)));
    sc.dispose();
    ids.set(f, found);
    return found;
  };
  const out = new Map<string, string>();
  for (const chain of chains)
    chain.forEach((deep, i) => {
      for (const up of chain.slice(0, i)) {
        if (up.factory === deep.factory || up.route === deep.route) continue;
        const key = `${deep.route}\n${up.route}`;
        if (out.has(key)) continue;
        const theirs = idsOf(up.factory);
        const shared = [...idsOf(deep.factory)].filter((id) => theirs.has(id)).sort();
        if (shared[0] !== undefined)
          out.set(
            key,
            `route ${deep.route}: stores: ${deep.name || "(anonymous)"} and ${up.name || "(anonymous)"} (${up.route}) both create store ${shared[0]}; name one factory`,
          );
      }
    });
  return [...out.values()];
}
