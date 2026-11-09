import { createCtx, register } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { err, ok, s } from "@keel/schema";
import { Session } from "./Session.schema.ts";
import type { SessionSink } from "./SessionSink.ts";

const PutFailed = s.error("sessions.putFailed", s.object({ status: s.int() }));
const failed = (status: number) => err(PutFailed.make({ status }));

function real(): SessionSink {
  const own = createCtx({ mode: "real" });
  return {
    async put(url, session) {
      try {
        const body = JSON.stringify(Session.encode(session));
        const headers = { "content-type": "application/json" };
        const res = await fetch(url, { method: "POST", body, headers, keepalive: true, credentials: "same-origin" });
        return res.ok ? ok(null) : failed(res.status);
      } catch {
        return failed(0);
      }
    },
    taken: () => [],
    id: () => own.random.id("Session"),
  };
}

function shell(): SessionSink {
  const own = createCtx({ mode: "real" });
  return { put: async () => ok(null), taken: () => [], id: () => own.random.id("Session") };
}

function sim({ seed }: { readonly seed: number }): SessionSink {
  const own = createCtx({ mode: "sim", seed });
  const kept: { readonly url: URL; readonly session: Session }[] = [];
  return {
    async put(url, session) {
      kept.push({ url, session });
      return ok(null);
    },
    taken: () => kept.slice(),
    id: () => own.random.id("Session"),
  };
}

/**
 * The `session` capability accessor (std.sessions; `register('session', { real, shell, sim })`, k.ctx). `Session`
 * lives in `Session.schema.ts`, so the two names do not collide on case-insensitive disks.
 */
export const session: (ctx: Ctx) => SessionSink = register("session", { real, shell, sim });
