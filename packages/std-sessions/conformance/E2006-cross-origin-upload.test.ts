// @vitest-environment happy-dom
// Spec: std.sessions, clause "`record` throws E2006 on a cross-origin `upload`, not on a same-origin one."
// Seed 1337
// The page origin is read from `location.origin`; it is never hard-coded.
import { createCtx } from "@keel/ctx";
import { record } from "@keel/std-sessions";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const attempt = (upload: URL): unknown => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  try {
    record(ctx, { upload }).stop();
  } catch (e) {
    return e;
  }
  return undefined;
};

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

describe("std.sessions: E2006 cross-origin upload", () => {
  test("`record` throws E2006 on a cross-origin `upload`, not on a same-origin one: another host throws", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(() => record(ctx, { upload: new URL("https://elsewhere.example/sessions") })).toThrow(/E2006/);
  });

  test("`record` throws E2006 on a cross-origin `upload`, not on a same-origin one: another port of the page host throws", () => {
    const url = new URL("/sessions", location.origin);
    url.port = url.port === "4999" ? "4998" : "4999";
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(() => record(ctx, { upload: url })).toThrow(/E2006/);
  });

  test("`record` throws E2006 on a cross-origin `upload`, not on a same-origin one: another scheme of the page host throws", () => {
    const url = new URL("/sessions", location.origin);
    url.protocol = url.protocol === "https:" ? "http:" : "https:";
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(() => record(ctx, { upload: url })).toThrow(/E2006/);
  });

  test("`record` throws E2006 on a cross-origin `upload`, not on a same-origin one: a same-origin upload returns a recorder", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const rec = record(ctx, { upload: new URL("/sessions", location.origin) });
    expect(typeof rec.stop).toBe("function");
    rec.stop();
  });

  test("`record` throws E2006 on a cross-origin `upload`, not on a same-origin one: a refused call leaves nothing behind", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(() => record(ctx, { upload: new URL("https://elsewhere.example/sessions") })).toThrow(/E2006/);
    const rec = record(ctx, { upload: new URL("/sessions", location.origin) });
    expect(typeof rec.stop).toBe("function");
    rec.stop();
  });

  test("`record` throws E2006 on a cross-origin `upload`, not on a same-origin one: any other hostname throws (property)", () => {
    fc.assert(
      fc.property(
        fc.domain().filter((d) => d.toLowerCase() !== location.hostname.toLowerCase()),
        (host) => {
          expect(messageOf(attempt(new URL(`https://${host}/sessions`)))).toContain("E2006");
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });
});
