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
import type { Route } from "./Route.ts";
import { actives } from "./actives.ts";
import { emptySession } from "./emptySession.ts";
import { fingerprint } from "./fingerprint.ts";
import { jsonOf } from "./jsonOf.ts";
import { redactionOf } from "./redactionOf.ts";

type Base = { readonly at: number; readonly route: Route; readonly state: JsonObject; readonly id: Id<"Session"> };
type Raw = KeelError<string, JsonValue>;

/**
 * A recorder on `ctx` (std.sessions `record`): `nav`, `fire`, `resource` and `error` from `observe`, `tx` from a
 * reactive read of every store's `log()`, each redacted as it is appended into a ring buffer of `limit` events.
 */
export function recording(ctx: Ctx, options: RecordOptions): Live {
  const limit = options.limit ?? 500;
  const seed = seedOf(ctx);
  const sink = session(ctx);
  const entries = Object.values(stdConfig(ctx, "@keel/std-sessions", SessionsConfig)).flatMap((c) => c.redact ?? []);
  const redaction = redactionOf(entries, seed ?? 0);

  let base: Base | undefined;
  let current: Route | undefined;
  let buf: SessionEvent[] = [];
  const raw: Raw[] = [];
  const bases = new WeakMap<SessionEvent, Omit<Base, "id">>();
  const inputs = new WeakMap<SessionEvent, Omit<Base, "id">>();
  const causes = new WeakMap<SessionEvent, { readonly error: Raw; readonly route: string }>();
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

  const append = (event: SessionEvent): void => {
    buf.push(event);
    if (buf.length <= limit) return;
    const cut = buf.findIndex((e) => e.kind === "nav");
    const at = cut < 0 ? undefined : buf[cut];
    const rebase = at === undefined ? undefined : bases.get(at);
    if (rebase !== undefined) {
      buf = buf.slice(cut + 1);
      base = { ...rebase, id: sink.id() };
      return;
    }
    // No navigation buffered: rebase to the newest input but the oldest, at the state it saw, keeping it and what
    // followed; else to now, keeping the appended event if it is an input (its effects are yet to come) or an error
    // (the one an upload is about).
    let f = buf.length - 1;
    while (f > 0 && buf[f]?.kind !== "fire") f--;
    const from = f > 0 ? inputs.get(buf[f] ?? event) : undefined;
    if (from !== undefined) {
      buf = buf.slice(f);
      base = { ...from, id: sink.id() };
      return;
    }
    buf = event.kind === "fire" || event.kind === "error" ? [event] : [];
    base = { ...here(), id: sink.id() };
  };

  const own = scope(() => {
    effect(() => pull());
  });

  const build = (): Session => {
    if (base === undefined) return emptySession(sink.id(), seed, ctx.clock.now());
    const first = buf.find((e) => e.kind === "error");
    const cause = first === undefined ? undefined : causes.get(first);
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
      fingerprint: fingerprint(cause?.error ?? null, cause?.route ?? base.route.id),
    };
  };

  const onEvent = (event: CtxEvent): void => {
    own.run(pull);
    const at = ctx.clock.now();
    if (event.kind === "nav") {
      const { route, href } = redaction.nav(event);
      current = route;
      if (base === undefined) {
        base = { at, route, state: own.run(snapshot), id: sink.id() };
        return;
      }
      const nav: SessionEvent = { at, kind: "nav", href };
      bases.set(nav, { at, route, state: own.run(snapshot) });
      append(nav);
      return;
    }
    if (event.kind === "error") {
      const error: Raw = { code: event.error.code, message: event.error.message, data: jsonOf(event.error.data) };
      raw.push(error);
      if (base === undefined) return;
      const e: SessionEvent = { at, kind: "error", error: redaction.error(error) };
      causes.set(e, { error, route: current?.id ?? base.route.id });
      append(e);
      if (options.upload !== undefined && !uploaded) {
        uploaded = true;
        void sink.put(options.upload, build());
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
