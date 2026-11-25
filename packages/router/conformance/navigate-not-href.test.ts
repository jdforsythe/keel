// @vitest-environment happy-dom
// k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: `navigate` of a value that is no `Href` rejects with E1501 and nothing moves; a raw `/a/\x` stays a same-origin document navigation (k.mount-scope, packages/testing/conformance/mount-router-scope.test.ts).
// Seed 1337 (fc.assert below). Both the router's `navigate` and the free `navigate` are called.
import { createCtx } from "@keel/ctx";
import { type Href, createRouter, manifest, navigate } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { SEED, memoryHistory, page, settle } from "./contract-support.ts";

const c = contract("nv", { "nv.home": { path: "/" }, "nv.other": { path: "/other" } });
const routes = manifest(c, { "nv.home": { component: page }, "nv.other": { component: page } });
const isHref = (v: string): v is Href => true;
const raw = (v: string): Href => {
  if (!isHref(v)) throw new Error("unreachable");
  return v;
};
const BAD = [
  "//evil.example/x",
  "/\\evil.example",
  "\\\\evil.example",
  "https://evil.example/",
  "javascript:alert(1)",
  "/a\u0085b",
  "/a\u0000b",
  "/a\nb",
  "/a\u007fb",
  "#frag",
  "",
  "mailto:a@b.c",
];
const codeOf = async (p: Promise<unknown>): Promise<unknown> => {
  try {
    await p;
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup.splice(0)) f();
});
function start() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const history = memoryHistory("/");
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
  cleanup.push(() => {
    unmount();
    router.dispose();
    host.remove();
  });
  return { router, history };
}

describe("rfc:0157 conformance: navigate of a value that is no Href", () => {
  it("the router's `navigate` rejects with E1501 for each of `//evil.example/x`, `/\\evil.example`, `https://evil.example/`, `javascript:alert(1)` and a control character, and the history and route stay", async () => {
    for (const to of BAD) {
      const { router, history } = start();
      await settle();
      expect(await codeOf(router.navigate(raw(to))), JSON.stringify(to)).toBe("E1501");
      await settle();
      expect(history.current(), JSON.stringify(to)).toBe("/");
      expect(router.route.get().id, JSON.stringify(to)).toBe("nv.home");
    }
  });

  it("the free `navigate` of the one mounted router rejects with E1501 for the same values, and nothing moves", async () => {
    for (const to of BAD) {
      const { router, history } = start();
      await settle();
      expect(await codeOf(navigate(raw(to))), JSON.stringify(to)).toBe("E1501");
      expect(history.current(), JSON.stringify(to)).toBe("/");
      expect(router.route.get().id, JSON.stringify(to)).toBe("nv.home");
      cleanup.pop()?.();
    }
  });

  it("a value that is an Href once `\\` reads as `/` and `#…` drops does not reject: `/a/\\x`, `/a#frag` and `/other#frag` resolve, and the page stays unless the path is a page", async () => {
    for (const to of ["/a/\\x", "/a#frag"]) {
      const { router, history } = start();
      await settle();
      expect(await codeOf(router.navigate(raw(to))), JSON.stringify(to)).toBeNull();
      await settle();
      expect(router.route.get().id).toBe("nv.home");
      expect(history.current()).toBe("/");
    }
    const { router } = start();
    await settle();
    expect(await codeOf(router.navigate(raw("/other#frag")))).toBeNull();
    await settle();
    expect(router.route.get().id).toBe("nv.other");
  });

  it("for any generated `//`-led, `/\\`-led, scheme-led or control-character string, navigate rejects with E1501 and nothing moves", async () => {
    const tail = fc.stringMatching(/^[a-z0-9./]{0,8}$/);
    const bad = fc.oneof(
      tail.map((t) => `//${t}`),
      tail.map((t) => `/\\${t}`),
      tail.map((t) => `https://${t}`),
      tail.map((t) => `javascript:${t}`),
      tail.map((t) => `/${t}\u0085`),
      tail.map((t) => `/${t}\u0000`),
    );
    const { router, history } = start();
    await settle();
    await fc.assert(
      fc.asyncProperty(bad, async (to) => {
        expect(await codeOf(router.navigate(raw(to))), JSON.stringify(to)).toBe("E1501");
        expect(history.current(), JSON.stringify(to)).toBe("/");
        expect(router.route.get().id, JSON.stringify(to)).toBe("nv.home");
      }),
      { seed: SEED, numRuns: 80 },
    );
  });
});
