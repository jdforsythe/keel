import type { ReplayResult } from "../ReplayResult.ts";
import { isInput } from "../internal/isInput.ts";
import type { ReplayGroupOptions } from "./ReplayGroupOptions.ts";
import type { ReplayGroupResult } from "./ReplayGroupResult.ts";
import type { SessionGroup } from "./SessionGroup.schema.ts";
import { groupDiags } from "./groupDiags.ts";
import { moduleUrl } from "./internal/moduleUrl.ts";
import { openHub } from "./internal/openHub.ts";
import { wire } from "./internal/wire.ts";

/**
 * Replay a session group (std.multi): check it as `keel session replay` does (`groupDiags`) and throw the first
 * diagnostic, its `code` E2007 or E2008, before any worker starts. Then restore the server storage from
 * `group.server`, open every user at its session's base (each in its own worker, under its session's `seed`, as
 * std.sessions `replay` renders a base), then apply all users' inputs in order of `at`, then user index, then event
 * index, advancing every clock to each `at` and settling after each input. An input a user's replay already produced
 * as an earlier input's effect is passed over (std.sessions `replay`); a user stops at an input that does not apply.
 * Returns each user's `ReplayResult`, each server store with its log, and `reproduced`: every user's fingerprint
 * matches.
 */
export async function replayGroup(group: SessionGroup, options: ReplayGroupOptions): Promise<ReplayGroupResult> {
  const [bad] = groupDiags(JSON.stringify(group), "group");
  if (bad !== undefined)
    throw Object.assign(new Error(`${String(bad.code)} ${String(bad.message)}`), { code: bad.code, see: "std.multi" });
  const user = moduleUrl(String(options.user), process.cwd());
  const h = await openHub({
    serve: options.serve,
    seed: group.seed,
    origin: group.origin,
    at: group.at,
    server: group.server,
    count: group.users.length,
    user,
  });
  try {
    for (const [i, session] of group.users.entries()) {
      const r = h.realms[i];
      if (r === undefined) continue;
      await r.call("open", { user, seed: session.seed ?? 0, origin: group.origin, at: session.at, session });
      await h.settle();
    }
    const inputs = group.users.flatMap((session, u) =>
      session.events.flatMap((e, index) => (isInput(e) ? [{ at: e.at, u, index }] : [])),
    );
    inputs.sort((a, b) => a.at - b.at || a.u - b.u || a.index - b.index);
    for (const input of inputs) {
      const r = h.realms[input.u];
      if (r === undefined) continue;
      await h.advanceTo(input.at);
      await r.call("apply", { index: input.index });
      await h.settle();
    }
    const users: ReplayResult[] = [];
    for (const r of h.realms) {
      const out = wire.replay.parse(await r.call("finish", null));
      if (!out.ok) throw new TypeError("group: bad replay answer");
      users.push(out.value);
    }
    return { users, server: await h.snapshots(), reproduced: users.every((u) => u.reproduced) };
  } finally {
    await h.close();
  }
}
