// @vitest-environment happy-dom
// E2006 beyond another host: a non-http(s) scheme on the page's origin (`blob:`) and a credentialed URL are refused;
// the real `put` refuses another origin itself and never follows a redirect. Seed 1337
import { createCtx } from "@keel/ctx";
import { afterEach, describe, expect, test, vi } from "vitest";
import { record, session } from "../src/index.ts";

const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : e;
  }
  return undefined;
};

afterEach(() => vi.unstubAllGlobals());

describe("upload origin", () => {
  test("a blob: URL on the page's origin throws E2006", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(codeOf(() => record(ctx, { upload: new URL(`blob:${location.origin}/0`) }))).toBe("E2006");
  });

  test("a URL with credentials on the page's origin throws E2006", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const url = new URL("/sessions", location.origin);
    url.username = "u";
    url.password = "p";
    expect(codeOf(() => record(ctx, { upload: url }))).toBe("E2006");
  });

  test('a sandboxed document (self.origin "null") refuses an upload to its URL\'s origin', () => {
    vi.stubGlobal("origin", "null");
    expect(self.origin).toBe("null");
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(codeOf(() => record(ctx, { upload: new URL("/sessions", location.origin) }))).toBe("E2006");
  });

  test("the real put sends with redirect error and refuses another origin without fetching", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: URL, init: RequestInit) => {
      calls.push(init);
      return new Response(null, { status: 204 });
    });
    const sink = session(createCtx({ mode: "real" }));
    const empty = record(createCtx({ mode: "sim", seed: 1337 })).stop();
    expect((await sink.put(new URL("https://elsewhere.example/sessions"), empty)).ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect((await sink.put(new URL("/sessions", location.origin), empty)).ok).toBe(true);
    expect(calls.map((c) => c.redirect)).toEqual(["error"]);
  });
});
