import { pid } from "node:process";
import { attempt } from "@keel/schema";
import pg from "pg";
import type { FollowEvent } from "../FollowEvent.ts";
import type { Changes } from "./Changes.ts";
import { classify } from "./classify.server.ts";
import { errors } from "./errors.server.ts";
import { field } from "./field.server.ts";
import { verifiedSslmode } from "./verifiedSslmode.server.ts";

const CHANNEL = "keel_changes";

type Follow = { readonly on: (e: FollowEvent) => void; listening: boolean };
type Listener = {
  /** Whether it is listening: `false` when the connection or `listen` failed, by the database's answer or the network's. */
  readonly ready: Promise<boolean>;
  readonly follows: Map<string, Set<Follow>>;
  readonly end: () => void;
  done: boolean;
};

/**
 * Shared by every evaluation of this module in the process (a `keel dev` reload evaluates it again): one listening
 * connection per URL.
 */
const KEY = Symbol.for("keel.postgres.listeners");

function sharedListeners(): Map<string, Listener> {
  const shared: unknown = Reflect.get(globalThis, KEY);
  if (shared instanceof Map) return shared;
  const made = new Map<string, Listener>();
  Reflect.set(globalThis, KEY, made);
  return made;
}

const listeners = sharedListeners();

const count = (l: Listener): number => [...l.follows.values()].reduce((n, set) => n + set.size, 0);

/**
 * The listening connection of `url`, opened outside the pool: `LISTEN keel_changes`, each notification handed to the
 * follows of its payload. Its error or end, unless the last follow stopped it, is `lost` once to every follow that was
 * listening, and the next `follow` opens a new one. Its `application_name` is `keel-listen-<pid>`, so an operator (and a test)
 * tells this process's listener from another's in `pg_stat_activity`.
 */
function open(url: string): Listener {
  const client = new pg.Client({
    connectionString: verifiedSslmode(url),
    connectionTimeoutMillis: 10_000,
    application_name: `keel-listen-${pid}`,
  });
  const follows = new Map<string, Set<Follow>>();
  const lost = (): void => {
    if (l.done) return;
    l.done = true;
    if (listeners.get(url) === l) listeners.delete(url);
    const all = [...follows.values()].flatMap((set) => [...set]);
    follows.clear();
    for (const f of all) if (f.listening) f.on({ kind: "lost" });
    void client.end();
  };
  client.on("error", lost);
  client.on("end", lost);
  client.on("notification", (m) => {
    if (m.channel !== CHANNEL || m.payload === undefined) return;
    for (const f of [...(follows.get(m.payload) ?? [])]) if (f.listening) f.on({ kind: "changed" });
  });
  const listening = async (): Promise<boolean> => {
    let up = false;
    try {
      const r = await attempt(
        async () => {
          await client.connect();
          await client.query(`listen ${CHANNEL}`);
        },
        (x) => (classify(x) !== null || field(x, "severity") !== "" ? errors.unreachable : undefined),
      );
      up = r.ok;
      return up;
    } finally {
      if (!up) lost();
    }
  };
  const l: Listener = {
    ready: listening(),
    follows,
    done: false,
    end: () => {
      l.done = true;
      if (listeners.get(url) === l) listeners.delete(url);
      void client.end();
    },
  };
  return l;
}

/** Changes on a `postgres:` URL: Postgres delivers each committed `pg_notify` to the listening connection of every process. */
export function listenChanges(url: string): Changes {
  return {
    async follow(text, on) {
      let l = listeners.get(url);
      if (l === undefined || l.done) {
        l = open(url);
        listeners.set(url, l);
      }
      const at = l;
      const f: Follow = { on, listening: false };
      const set = at.follows.get(text) ?? new Set();
      at.follows.set(text, set);
      set.add(f);
      const stop = (): void => {
        set.delete(f);
        if (set.size === 0 && at.follows.get(text) === set) at.follows.delete(text);
        if (!at.done && count(at) === 0) at.end();
      };
      const opened = await at.ready;
      if (!opened || at.done) {
        stop();
        on({ kind: "lost" });
        return stop;
      }
      f.listening = true;
      return stop;
    },
    committed() {},
  };
}
