import type { Ctx } from "@keel/ctx";
import { defect } from "@keel/schema";
import { State } from "./State.schema.ts";
import { chanOf } from "./chanOf.ts";
import { snapshot } from "./snapshot.ts";

const noop = (): void => undefined;

/**
 * Read `module`'s queue from `ctx.storage`, let `fn` change it, and `commit` it against the value read when it changed,
 * reading again and rerunning `fn` while the commit is refused (another process wrote first). Serialized with every
 * other transaction on that key in this process. A stored value that is not a queue throws.
 */
export function transact<T>(ctx: Ctx, module: string, fn: (st: State) => T): Promise<T> {
  const key = `std.jobs.${module}`;
  const c = chanOf(ctx.storage, key);
  const work = async (): Promise<T> => {
    for (;;) {
      const [raw = null] = await ctx.storage.read([key]);
      const r = State.parse(raw === null ? { q: [], done: [], failed: [] } : JSON.parse(raw));
      if (!r.ok) defect(`std.jobs: ${key} does not hold a queue`);
      const out = fn(r.value);
      const text = JSON.stringify(r.value);
      if (text === raw || (await ctx.storage.commit([{ key, expect: raw, value: text }]))) {
        snapshot(ctx.storage, module, r.value, ctx.clock.now());
        return out;
      }
    }
  };
  const p = c.tail.then(work);
  c.tail = p.then(noop, noop);
  return p;
}
