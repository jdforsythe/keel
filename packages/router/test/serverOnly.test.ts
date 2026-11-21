// Stubs of server-only exports (k.boundary Browser builds): each throws E1008 naming itself and its file when called,
// and `manifest` takes them where a loader, action or guard goes.
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { serverOnly } from "../src/internal/serverOnly.ts";
import { manifest } from "../src/manifest.ts";

const thrown = (f: () => unknown): unknown => {
  try {
    f();
  } catch (e) {
    return e;
  }
  return undefined;
};

describe("serverOnly", () => {
  it("throws an Error with code E1008 naming the export and the file, for any names", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (file, name) => {
        const e = thrown(serverOnly(file, name));
        expect(e).toBeInstanceOf(Error);
        expect(Reflect.get(Object(e), "code")).toBe("E1008");
        expect(e instanceof Error ? e.message : "").toBe(`E1008 ${name} of ${file} runs only on the server`);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("reads `undefined` for any other property", () => {
    expect(Reflect.get(serverOnly("a.server.ts", "LIMIT"), "max")).toBeUndefined();
  });
});

/** `manifest` over values its types refuse (stubs stand in for loaders, actions and guards in a browser build). */
const bind = (c: unknown, binding: unknown): unknown => Reflect.apply(manifest, undefined, [c, binding]);

describe("manifest with stubs", () => {
  const Params = s.object({ id: s.string() });
  const page = () => null;
  const k = contract("a", {
    "a.home": { path: "/" },
    "a.show": { path: "/a/:id", params: Params },
    "a.api": { method: "GET", path: "/api/a", output: s.object({}) },
    "a.save": { method: "POST", path: "/api/a", output: s.object({}) },
  });
  it("takes a stub guard, loader and action and still links", () => {
    expect(() =>
      bind(k, {
        "a.home": { component: page },
        "a.show": {
          component: page,
          guard: serverOnly("a.guard.ts", "auth"),
          loader: serverOnly("a.server.ts", "load"),
          POST: serverOnly("a.server.ts", "save"),
        },
        "a.api": { loader: serverOnly("a.server.ts", "loadApi") },
        "a.save": { action: serverOnly("a.server.ts", "saveApi") },
      }),
    ).not.toThrow();
    expect(k.href("a.show", { id: "q r" })).toBe("/a/q%20r");
  });

  it("still refuses a plain object that is not an action", () => {
    const one = contract("b", { "b.show": { path: "/b" } });
    const e = thrown(() => bind(one, { "b.show": { component: page, POST: {} } }));
    expect(Reflect.get(Object(e), "code")).toBe("E1515");
  });
});
