import { type SimCtx, createCtx } from "@keel/ctx";
import type { JsonValue } from "@keel/schema";
import type { Snapshot } from "@keel/store";
import type { Serve } from "../Serve.ts";
import type { Hub } from "./Hub.ts";
import type { Outgoing } from "./Outgoing.ts";
import { drained } from "./drained.ts";
import { startRealm } from "./startRealm.ts";
import { wire } from "./wire.ts";

const PREFIX = "keel.store.";
/** Rounds `settle` runs at most before it reports traffic that never goes quiet. */
const MAX_ROUNDS = 500;
/** Turns `settle` waits for a server answer before it takes the request as waiting on the sim clock. */
const IDLE_TURNS = 200;

/**
 * Open a hub: a sim ctx of `seed` whose storage starts with `server` (each value as stored, JSON text, under
 * `keel.store.<id>`), its clock at `at`, `serve` over it, and `count` user workers whose requests to `origin` reach
 * that server with a cookie jar each.
 */
export async function openHub(options: {
  readonly serve: Serve;
  readonly seed: number;
  readonly origin: string;
  readonly at: number;
  readonly server: { readonly [store: string]: JsonValue };
  readonly count: number;
}): Promise<Hub> {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: options.seed });
  // The server's own writes name the stores a replay reports; this storage capability is the hub's alone.
  const keys = new Set<string>();
  const storage = ctx.storage;
  const set = storage.set;
  Object.assign(storage, {
    set: (key: string, value: string): Promise<void> => {
      if (key.startsWith(PREFIX)) keys.add(key);
      return set(key, value);
    },
  });
  for (const [id, v] of Object.entries(options.server))
    await storage.set(`${PREFIX}${id}`, typeof v === "string" ? v : JSON.stringify(v));
  if (options.at > 0) ctx.clock.advance(options.at);
  const app = options.serve(ctx);

  let activity = 0;
  let waiting = 0;
  const touch = (): void => {
    activity++;
  };
  const jars = Array.from({ length: options.count }, () => new Map<string, string>());
  const fetchAs =
    (jar: Map<string, string>) =>
    async (out: Outgoing): Promise<Response> => {
      if (jar.size > 0) out.headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
      waiting++;
      try {
        const res = await app.fetch(new Request(out.url, { method: out.method, headers: out.headers, body: out.body }));
        for (const line of setCookies(res.headers)) {
          const pair = line.split(";")[0] ?? "";
          const eq = pair.indexOf("=");
          if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
        }
        return res;
      } finally {
        waiting--;
      }
    };
  const realms = jars.map((jar) => startRealm(options.origin, fetchAs(jar), touch));

  const settle = async (): Promise<void> => {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const before = activity;
      await drained();
      for (const r of realms) await r.call("settle", null);
      await drained();
      for (let turn = 0; activity === before && waiting > 0 && turn < IDLE_TURNS; turn++) await drained();
      if (activity === before) return;
    }
    throw new Error("group did not settle");
  };

  const read = async (key: string): Promise<unknown> => {
    const raw = await storage.get(key);
    try {
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  };

  return {
    realms,
    settle,
    now: () => ctx.clock.now(),
    advanceTo: async (at) => {
      if (at > ctx.clock.now()) ctx.clock.advance(at - ctx.clock.now());
      for (const r of realms) await r.call("advanceTo", { ms: at });
    },
    stored: async () => {
      const out: { [store: string]: string } = {};
      for (const key of keys) {
        const raw = await storage.get(key);
        if (raw !== null) out[key.slice(PREFIX.length)] = raw;
      }
      return out;
    },
    snapshots: async () => {
      const out: { [store: string]: Snapshot<JsonValue> } = {};
      for (const key of keys) {
        const r = wire.snapshot.parse(await read(key));
        if (r.ok) out[key.slice(PREFIX.length)] = r.value;
      }
      return out;
    },
    close: async () => {
      await Promise.all(realms.map((r) => r.terminate()));
    },
  };
}

/** Each `Set-Cookie` line of `headers`. */
function setCookies(headers: Headers): string[] {
  const list = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (list.length > 0) return list;
  const one = headers.get("set-cookie");
  return one === null ? [] : one.split(/,(?=\s*[^;,=\s]+=)/);
}
