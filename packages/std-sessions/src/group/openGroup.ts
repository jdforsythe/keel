import type { JsonValue } from "@keel/schema";
import type { Group } from "./Group.ts";
import type { GroupOptions } from "./GroupOptions.ts";
import type { GroupUser } from "./GroupUser.ts";
import { SessionGroup } from "./SessionGroup.schema.ts";
import { moduleUrl } from "./internal/moduleUrl.ts";
import { openHub } from "./internal/openHub.ts";
import { userSeed } from "./internal/userSeed.ts";
import { wire } from "./internal/wire.ts";

/**
 * Open a session group (std.multi): `serve` over a sim ctx of `seed` whose storage starts with `server`, and `users`
 * users, each in its own worker thread with its own DOM, modules and sim ctx (seed from `seed` and its index), each
 * rendering the user module's `base` at `at` under `record(ctx, { limit: Infinity })` and reaching the server through
 * its sim net at `origin` with its own cookie jar. Users open in index order, the group settling after each.
 */
export async function openGroup(options: GroupOptions): Promise<Group> {
  const at = options.at ?? 0;
  const user = moduleUrl(String(options.user), process.cwd());
  const h = await openHub({
    serve: options.serve,
    seed: options.seed,
    origin: options.origin,
    at,
    server: options.server ?? {},
    count: options.users,
    user,
  });
  const server: { [store: string]: JsonValue } = {};
  try {
    for (const [id, v] of Object.entries(await h.stored())) server[id] = v;
    for (const [i, r] of h.realms.entries()) {
      await r.call("open", { user, seed: userSeed(options.seed, i), origin: options.origin, at, session: null });
      await h.settle();
    }
  } catch (error) {
    await h.close();
    throw error;
  }
  const realmOf = (i: number) => {
    const r = h.realms[i];
    if (r === undefined) throw new RangeError(`group: no user ${i} (users: ${h.realms.length})`);
    return r;
  };
  const users: GroupUser[] = h.realms.map((_, i) => ({
    fire: async (id, event) => {
      await realmOf(i).call("fire", { at: 0, kind: "fire", id, event });
    },
    navigate: async (href) => {
      await realmOf(i).call("navigate", { href });
    },
    find: async (id) => {
      const r = wire.found.parse(await realmOf(i).call("find", { id }));
      if (!r.ok) throw new TypeError("group: bad find answer");
      return r.value;
    },
    state: async () => {
      const r = wire.state.parse(await realmOf(i).call("state", null));
      if (!r.ok) throw new TypeError("group: bad state answer");
      return r.value;
    },
  }));
  return {
    user: (i) => {
      realmOf(i);
      const u = users[i];
      if (u === undefined) throw new RangeError(`group: no user ${i}`);
      return u;
    },
    setOnline: async (i, online) => {
      await realmOf(i).call("setOnline", { online });
    },
    advance: async (ms) => {
      await h.advanceTo(h.now() + Math.max(0, ms));
    },
    settle: () => h.settle(),
    stop: async () => {
      try {
        await h.settle();
        const sessions = [];
        for (const r of h.realms) {
          const s = wire.session.parse(await r.call("stop", null));
          if (!s.ok) throw new TypeError("group: bad session");
          sessions.push(s.value);
        }
        const group = { v: 1, seed: options.seed, at, origin: options.origin, server, users: sessions };
        const r = SessionGroup.parse(group);
        if (!r.ok) throw new TypeError(`group: recorded group fails SessionGroup: ${r.error.message}`);
        return r.value;
      } finally {
        await h.close();
      }
    },
  };
}
