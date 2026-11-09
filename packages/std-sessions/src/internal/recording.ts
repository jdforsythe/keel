import { stdConfig } from "@keel/compiler/std/stdConfig";
import { type Ctx, type CtxEvent, observe, seedOf } from "@keel/ctx";
import { effect, scope } from "@keel/reactive";
import type { Id, JsonValue, KeelError } from "@keel/schema";
import { stores } from "@keel/store";
import type { RecordOptions } from "../RecordOptions.ts";
import type { Session } from "../Session.schema.ts";
import type { SessionEvent } from "../SessionEvent.ts";
import { SessionsConfig } from "../SessionsConfig.ts";
import { session } from "../session.ts";
import type { JsonObject } from "./JsonObject.ts";
import type { Live } from "./Live.ts";
import { MAX_ERRORS } from "./MAX_ERRORS.ts";
import { MAX_SESSION_BYTES } from "./MAX_SESSION_BYTES.ts";
import type { Route } from "./Route.ts";
import { actives } from "./actives.ts";
import { emptySession } from "./emptySession.ts";
import { jsonOf } from "./jsonOf.ts";
import { redactionOf } from "./redactionOf.ts";
import { sessionFingerprint } from "./sessionFingerprint.ts";
import { utf8Length } from "./utf8Length.ts";

type Base = { readonly at: number; readonly route: Route; readonly state: JsonObject; readonly id: Id<"Session"> };
type Raw = KeelError<string, JsonValue>;

/** Bytes of a session's JSON outside `route`, `state`, `events` and `error`: keys, `v`, `id`, `seed`, `at`, fingerprint. */
const OVERHEAD = 256;
const sizeOf = (v: unknown): number => utf8Length(JSON.stringify(v) ?? "");

/**
 * A recorder on `ctx` (std.sessions `record`): `nav`, `fire`, `resource` and `error` from `observe`, `tx` from a
 * reactive read of every store's `log()`, each redacted as it is appended into a ring buffer of `limit` events whose
 * session JSON stays within `MAX_SESSION_BYTES`: past either bound it cuts its oldest events by the
 * overflow rule. `errors()` keeps the first and last `MAX_ERRORS`. A rejected upload is recorded as its
 * `sessions.putFailed` error, not dropped.
 */
export function recording(ctx: Ctx, options: RecordOptions): Live {
  const limit = options.limit ?? 500;
  const seed = seedOf(ctx);
  const sink = session(ctx);
  const entries = Object.values(stdConfig(ctx, "@keel/std-sessions", SessionsConfig)).flatMap((c) => c.redact ?? []);
  const redaction = redactionOf(entries, seed ?? 0);

  let base: Base | undefined;
  let baseBytes = 0;
  let current: Route | undefined;
  let buf: SessionEvent[] = [];
  let used = 0;
  const sizes = new WeakMap<SessionEvent, number>();
  const raw: Raw[] = [];
  const bases = new WeakMap<SessionEvent, Omit<Base, "id">>();
  const inputs = new WeakMap<SessionEvent, Omit<Base, "id">>();
  const seen = new Map<string, number>();
  let uploaded = false;
  let done: Session | undefined;

  const snapshot = (): JsonObject => {
    const out: Record<string, JsonValue> = {};
    for (const [id, st] of stores()) out[id] = redaction.state(id, st.schema, jsonOf(st.snapshot().state));
    return out;
  };

  const here = (): Omit<Base, "id"> => ({
    at: ctx.clock.now(),
    route: current ?? { id: "", params: {}, search: {} },
    state: own.run(snapshot),
  });

  /** Append every log entry newer than the last seen, per store (before the base: only mark them seen). */
  const pull = (): void => {
    for (const [id, st] of stores()) {
      const last = seen.get(id) ?? Number.NEGATIVE_INFINITY;
      for (const e of st.log()) {
        if (e.id <= last) continue;
        seen.set(id, e.id);
        if (base === undefined) continue;
        const schema = st.payloads.get(e.name);
        const payload = redaction.tx(e.name, schema, jsonOf(e.payload, schema));
        append({ at: ctx.clock.now(), kind: "tx", store: id, name: e.name, payload });
      }
    }
  };

  const rebase = (to: Omit<Base, "id">): void => {
    base = { ...to, id: sink.id() };
    baseBytes = sizeOf(to.route) + sizeOf(to.state);
  };
  const keep = (next: SessionEvent[], to: Omit<Base, "id">): void => {
    buf = next;
    used = next.reduce((n, e) => n + (sizes.get(e) ?? 0), 0);
    rebase(to);
  };
  /** An upper bound of the session's JSON bytes: `error` repeats the first error event's error. */
  const total = (): number => {
    const first = buf.find((e) => e.kind === "error");
    return OVERHEAD + baseBytes + used + buf.length + (first === undefined ? 0 : (sizes.get(first) ?? 0));
  };

  /** One overflow cut (std.sessions): through the oldest `nav`; else from the second input; else to now. */
  const cut = (event: SessionEvent): void => {
    const at = buf.findIndex((e) => e.kind === "nav");
    const to = at < 0 ? undefined : bases.get(buf[at] ?? event);
    if (to !== undefined) {
      keep(buf.slice(at + 1), to);
      return;
    }
    // No navigation buffered: rebase to the oldest input but the first, at the state it saw, keeping it and what
    // followed; else to now, keeping the appended event if it is an input (its effects are yet to come) or an error
    // (the one an upload is about).
    const f = buf.findIndex((e, i) => i > 0 && e.kind === "fire");
    const from = f > 0 ? inputs.get(buf[f] ?? event) : undefined;
    if (from !== undefined) keep(buf.slice(f), from);
    else keep(event.kind === "fire" || event.kind === "error" ? [event] : [], here());
  };

  const append = (event: SessionEvent): void => {
    const size = sizeOf(event) + 1;
    sizes.set(event, size);
    buf.push(event);
    used += size;
    while (buf.length > limit || total() > MAX_SESSION_BYTES) {
      const before = buf.length;
      cut(event);
      if (buf.length < before) continue;
      // The appended event alone is over the byte bound: the session keeps none and rebases to now.
      if (buf.length > 0) keep([], here());
      return;
    }
  };

  const pushError = (error: Raw): void => {
    raw.push(error);
    if (raw.length > 2 * MAX_ERRORS) raw.splice(MAX_ERRORS, 1);
  };

  const own = scope(() => {
    effect(() => pull());
  });

  const build = (): Session => {
    if (base === undefined) return emptySession(sink.id(), seed, ctx.clock.now());
    const first = buf.find((e) => e.kind === "error");
    return {
      v: 1,
      id: base.id,
      ...(seed === undefined ? {} : { seed }),
      deterministic: seed !== undefined,
      at: base.at,
      route: base.route,
      state: base.state,
      events: buf.slice(),
      error: first?.kind === "error" ? first.error : null,
      fingerprint: sessionFingerprint({ events: buf, route: base.route }),
    };
  };

  const onEvent = (event: CtxEvent): void => {
    own.run(pull);
    const at = ctx.clock.now();
    if (event.kind === "nav") {
      const { route, href } = redaction.nav(event);
      current = route;
      if (base === undefined) {
        rebase({ at, route, state: own.run(snapshot) });
        return;
      }
      const nav: SessionEvent = { at, kind: "nav", href };
      bases.set(nav, { at, route, state: own.run(snapshot) });
      append(nav);
      return;
    }
    if (event.kind === "error") {
      const error: Raw = { code: event.error.code, message: event.error.message, data: jsonOf(event.error.data) };
      pushError(error);
      if (base === undefined) return;
      const route = current?.id ?? base.route.id;
      append({ at, kind: "error", route, error: redaction.error(error) });
      if (options.upload !== undefined && !uploaded) {
        uploaded = true;
        void sink.put(options.upload, build()).then((r) => {
          if (r.ok) return;
          if (done === undefined) onEvent({ kind: "error", error: r.error });
          else pushError(r.error);
        });
      }
      return;
    }
    if (base === undefined) return;
    if (event.kind === "fire") {
      const e = redaction.fire({ at, kind: "fire", id: event.id, event: event.event });
      inputs.set(e, here());
      append(e);
    } else append({ at, kind: "resource", id: event.id, state: event.state });
  };
  const unobserve = observe(ctx, onEvent);

  const live: Live = {
    recorder: {
      events: () => buf.slice(),
      errors: () => raw.slice(),
      stop() {
        if (done !== undefined) return done;
        unobserve();
        own.run(pull);
        own.dispose();
        if (actives.get(ctx) === live) actives.delete(ctx);
        done = build();
        return done;
      },
    },
    peek: () => done ?? build(),
  };
  return live;
}
