import { report as tell } from "@keel/ctx/internal";
import { computed, effect } from "@keel/reactive";
import type { HostEntry } from "../internal/HostEntry.ts";
import { InvalidThrow } from "../internal/InvalidThrow.ts";
import { current } from "../internal/current.ts";
import { cx } from "../internal/cx.ts";
import { guard } from "../internal/guard.ts";
import { harnessed } from "../internal/harnessed.ts";
import { hosts } from "../internal/hosts.ts";
import { invalidOf } from "../internal/invalidOf.ts";
import { report } from "../internal/report.ts";
import { serverMode } from "../internal/serverMode.ts";
import { toCaught } from "../internal/toCaught.ts";
import { writesOf } from "../internal/writesOf.ts";
import type { HostDef } from "../types/HostDef.ts";
import type { HostStart } from "../types/HostStart.ts";
import type { InvalidValueError } from "../types/InvalidValueError.ts";

type Running<I> = ReturnType<HostStart<I, unknown>["start"]>;

/**
 * The host element's lifecycle (k.host-element, k.host-code) for `el`, a `Host`'s `div`, called while it renders.
 * The server runs nothing. Resume never claims `el`'s children. In a harness (its ctx marked) `code` never runs and
 * the element is registered for `find` and `fire`. Otherwise `code()` resolves, then `mount` runs in the next
 * animation frame with the current value; a change of a `live` value requests a frame when none is pending, and the
 * frame calls `update` unless the latest value `Object.is` the one last given. Under `mode: 'dev'` and in a harness
 * `input` parses each value first: a failure is `schema.invalid` to the nearest Boundary, and no `mount` or `update`
 * runs with it. Each `emit` is parsed by `events`, reported to the ctx as a `fire` of `type: 'emit'`, then given to
 * `onEvent` as a handler. Disposing the scope cancels a pending frame, calls `dispose` once (its throw reported to
 * the ctx and dropped), then aborts the code's `signal`. Every other throw goes to the Boundary with `data.at` the id.
 */
export function host<I, E>(el: HTMLElement, def: HostDef<I, E>): void {
  if (serverMode.on) return;
  const region = cx.claim?.region;
  if (region) region.pos = region.nodes.length;
  const owner = current("host");
  const { id, input, events } = def;
  const ctx = owner.root.ctx;
  const test = ctx !== undefined && harnessed().has(ctx);
  const parse = test || owner.root.dev;

  const emit = (detail: unknown): InvalidValueError | null => {
    if (events === undefined) return invalidOf(id, `${id} has no events schema`);
    const r = events.parse(detail);
    if (!r.ok) return invalidOf(id, r.error);
    tell(ctx, { kind: "fire", id, event: { type: "emit", detail: events.encode(r.value) } });
    guard(owner, id, () => def.onEvent?.(r.value));
    return null;
  };
  /** The value if it may reach the code: parsed first under `dev` and in a harness. */
  const checked = (
    v: I,
  ): { readonly ok: true; readonly v: I } | { readonly ok: false; readonly error: InvalidValueError } => {
    if (!parse) return { ok: true, v };
    const r = input.parse(v);
    return r.ok ? { ok: true, v } : { ok: false, error: invalidOf(id, r.error) };
  };

  let latest: I;
  let ready = false;
  let gone = false;
  let code: HostStart<I, E> | null = null;
  let running: Running<I> | null = null;
  let given: I;
  let frame: number | null = null;
  const signal = new AbortController();

  const tick = (): void => {
    frame = null;
    if (gone || code === null || !ready) return;
    try {
      if (running === null) {
        given = latest;
        running = code.start(el, latest, {
          emit: (e) => {
            if (gone) return;
            const error = emit(e);
            if (error !== null) report(owner, new InvalidThrow(error), id);
          },
          signal: signal.signal,
        });
      } else if (!Object.is(latest, given)) {
        const prev = given;
        given = latest;
        running.update(latest, prev);
      }
    } catch (error) {
      report(owner, error, id);
    }
  };
  const request = (): void => {
    if (frame === null && code !== null && !gone) frame = requestAnimationFrame(tick);
  };

  if (def.live) {
    const value = computed(def.value);
    effect(
      () => {
        const ok = checked(value.get());
        if (owner.gone) return;
        if (!ok.ok) {
          report(owner, new InvalidThrow(ok.error), id);
          return;
        }
        latest = ok.v;
        ready = true;
        if (running !== null) request();
      },
      { writes: writesOf(owner) },
    );
  } else {
    const ok = checked(def.value());
    if (!ok.ok) throw new InvalidThrow(ok.error);
    latest = ok.v;
    ready = true;
  }

  if (test) {
    const entry: HostEntry = { value: () => input.encode(latest), emit };
    hosts.set(el, entry);
    return;
  }
  owner.cleanups.push(() => {
    gone = true;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    const r = running;
    running = null;
    if (r !== null)
      try {
        r.dispose();
      } catch (error) {
        tell(ctx, { kind: "error", error: toCaught(error, id) });
      }
    signal.abort();
  });
  Promise.resolve()
    .then(() => def.code())
    .then(
      (c) => {
        if (gone || owner.gone) return;
        code = c;
        request();
      },
      (error: unknown) => report(owner, error, id),
    );
}
