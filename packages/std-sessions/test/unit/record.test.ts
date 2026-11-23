// @vitest-environment happy-dom
// `record`: one recorder per ctx until it stops, the E2006 it throws for an upload that is not on the page's origin,
// the inert recorder of a render with no document, and the `sessions.live` inspect section.
// Seed 1337 (no random inputs)
import { inspectors } from "@keel/compiler/inspect/inspectors";
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Session } from "../../src/Session.schema.ts";
import { fingerprint } from "../../src/internal/fingerprint.ts";
import { inert } from "../../src/internal/inert.ts";
import { record } from "../../src/record.ts";
import { session } from "../../src/session.ts";

afterEach(() => vi.unstubAllGlobals());
const sim = (seed = 1337) => createCtx({ mode: "sim", seed });
const live = (ctx: ReturnType<typeof sim>): unknown => inspectors.get("sessions.live")?.read(ctx);

describe("record", () => {
  test("a ctx has one recorder until it stops: record returns it again and ignores the new options", () => {
    const ctx = sim();
    const first = record(ctx, { limit: 3 });
    expect(record(ctx)).toBe(first);
    expect(record(ctx, { limit: 9, upload: new URL("https://elsewhere.test/x") })).toBe(first);
    expect(record(sim())).not.toBe(first);
    first.stop();
    const second = record(ctx);
    expect(second).not.toBe(first);
    second.stop();
  });

  test("an upload on the page's own origin is accepted", () => {
    const ctx = sim();
    const rec = record(ctx, { upload: new URL("/sessions", location.origin) });
    expect(rec.events()).toEqual([]);
    rec.stop();
  });

  test("an upload elsewhere throws E2006, naming its scheme and host and the page's origin, and records nothing", () => {
    const ctx = sim();
    let thrown: unknown;
    try {
      record(ctx, { upload: new URL("https://user:pw@elsewhere.test:8443/sessions?x=1") });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toMatchObject({
      code: "E2006",
      see: "std.sessions",
      message: `E2006 upload https://elsewhere.test:8443 is not this page's origin (${location.origin})`,
    });
    expect(live(ctx)).toBeNull();
    const rec = record(ctx);
    expect(live(ctx)).not.toBeNull();
    rec.stop();
  });

  test("the sessions.live section is the session so far while recording, and null before and after", () => {
    const ctx = sim();
    expect(live(ctx)).toBeNull();
    const rec = record(ctx);
    const now = Session.parse(live(ctx));
    expect(now.ok).toBe(true);
    const stopped = rec.stop();
    expect(now.ok && now.value.events).toEqual(stopped.events);
    expect(live(ctx)).toBeNull();
    const section = inspectors.get("sessions.live");
    expect(section?.schema.parse(null).ok).toBe(true);
    expect(section?.schema.parse(Session.encode(stopped)).ok).toBe(true);
    expect(section?.schema.parse({ v: 2 }).ok).toBe(false);
  });
});

describe("record without a document", () => {
  test("it observes nothing, puts nothing, and stops with the empty session of its ctx", () => {
    vi.stubGlobal("document", undefined);
    const ctx = sim(7);
    ctx.clock.advance(40);
    const rec = record(ctx, { upload: new URL("https://elsewhere.test/never-checked") });
    expect(record(ctx)).toBe(rec);
    expect(rec.events()).toEqual([]);
    expect(rec.errors()).toEqual([]);
    expect(live(ctx)).toBeNull();
    const stopped = rec.stop();
    expect(stopped).toEqual({
      v: 1,
      id: stopped.id,
      seed: 7,
      deterministic: true,
      at: 40,
      route: { id: "", params: {}, search: {} },
      state: {},
      events: [],
      error: null,
      fingerprint: fingerprint(null, ""),
    });
    expect(Session.parse(Session.encode(stopped)).ok).toBe(true);
    expect(session(ctx).taken()).toEqual([]);
    expect(rec.stop()).toBe(stopped);
    const next = record(ctx);
    expect(next).not.toBe(rec);
    next.stop();
  });

  test("the inert recorder leaves another recorder of its ctx in place when it stops", () => {
    const ctx = sim();
    const real = record(ctx);
    const spare = inert(ctx);
    expect(spare.peek()).toBeNull();
    expect(spare.note({ kind: "net", online: false })).toBeUndefined();
    spare.recorder.stop();
    expect(record(ctx)).toBe(real);
    real.stop();
  });

  test("a ctx with no seed stops with no seed, not deterministic", () => {
    vi.stubGlobal("document", undefined);
    const stopped = record(createCtx({ mode: "real", signal: AbortSignal.abort() })).stop();
    expect("seed" in stopped).toBe(false);
    expect(stopped.deterministic).toBe(false);
  });
});
