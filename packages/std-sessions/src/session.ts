import { createCtx, register } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { err, ok } from "@keel/schema";
import { Session } from "./Session.schema.ts";
import type { SessionSink } from "./SessionSink.ts";
import { PutFailed } from "./internal/PutFailed.ts";
import { pageOrigin } from "./internal/pageOrigin.ts";
import { uploadable } from "./internal/uploadable.ts";
import { utf8Length } from "./internal/utf8Length.ts";

/** Browsers refuse a `keepalive` request body over 64 KiB (Fetch spec), so a larger session goes without it. */
const KEEPALIVE_BYTES = 65_536;

const failed = (status: number) => err(PutFailed.make({ status }));

function real(): SessionSink {
  const own = createCtx({ mode: "real" });
  // Only `random` is used: the window listeners its net added go at once.
  own.dispose();
  return {
    async put(url, session) {
      try {
        const body = JSON.stringify(Session.encode(session));
        const headers = { "content-type": "application/json" };
        const keepalive = utf8Length(body) <= KEEPALIVE_BYTES;
        // Same-origin only, and never followed elsewhere: a redirect could re-post the session to another origin.
        if (!uploadable(url, pageOrigin())) return failed(0);
        const res = await fetch(url, {
          method: "POST",
          body,
          headers,
          keepalive,
          credentials: "same-origin",
          redirect: "error",
        });
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
  // Only `random` is used: the window listeners its net added go at once.
  own.dispose();
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
