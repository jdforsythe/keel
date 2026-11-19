// Stubs of server-only exports (k.boundary Browser builds): each throws E1008 naming itself and its file when called,
// and `manifest` and `routes.actions` take them where a loader, action or guard goes.
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
const loose: { manifest(routes: unknown): unknown } = { manifest };
const call = (o: unknown, key: string, ...args: unknown[]): unknown => {
  const f: unknown = Reflect.get(Object(o), key);
  if (typeof f !== "function") throw new Error(`no ${key}`);
  return Reflect.apply(f, o, args);
};

describe("manifest with stubs", () => {
  const Params = s.object({ id: s.string() });
  const page = () => null;
  it("takes a stub guard, loader and action and still links", () => {
    const routes = loose.manifest({
      "a.home": { path: "/", component: page },
      "a.show": {
        path: "/a/:id",
        params: Params,
        guard: serverOnly("a.guard.ts", "auth"),
        loader: serverOnly("a.server.ts", "load"),
        component: page,
      },
      "a.api": { api: true, path: "/api/a", loader: serverOnly("a.server.ts", "loadApi") },
    });
    expect(() => call(routes, "actions", { "a.show": { POST: serverOnly("a.server.ts", "save") } })).not.toThrow();
    expect(() => call(routes, "actions", { "a.api": { POST: serverOnly("a.server.ts", "saveApi") } })).not.toThrow();
    expect(call(routes, "href", "a.show", { id: "q r" })).toBe("/a/q%20r");
  });

  it("still refuses a plain object that is not an action", () => {
    const routes = loose.manifest({ "b.show": { path: "/b", component: page } });
    const e = thrown(() => call(routes, "actions", { "b.show": { POST: {} } }));
    expect(Reflect.get(Object(e), "code")).toBe("E1505");
  });
});
