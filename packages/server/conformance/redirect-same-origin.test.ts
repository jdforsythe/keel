// @vitest-environment happy-dom
// k.server, Request flow "run it, 303 to the target (document; one no `Href` (k.router Links) is 500 with no `Location`) or `Result` JSON (runtime)."
// k.router (Links) "An `Href` starts with one `/` and holds no `\`, control character or `#`."
// Seed 1337 (fc.assert below). An action's link is a raw string typed as an `Href` through a type predicate.
import { type Href, action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, boot, form } from "./contract-support.ts";

const c = contract("a", {
  "a.home": { path: "/" },
  "a.item": { path: "/item/:slug", params: s.object({ slug: s.string() }) },
});
const isHref = (v: string): v is Href => true;
const raw = (v: string): Href => {
  if (!isHref(v)) throw new Error("unreachable");
  return v;
};
let next: string | null = null;
const act = action(c, "a.item", { input: s.object({}) }, () => ok(next === null ? null : raw(next)));
const page = (): Node => document.createElement("main");
const routes = manifest(c, { "a.home": { component: page }, "a.item": { component: page, POST: act } });
// The clause names control characters: C0 and C1 and DEL.
const isControl = (v: string): boolean =>
  [...v].some((ch) => {
    const n = ch.charCodeAt(0);
    return n <= 0x1f || (n >= 0x7f && n <= 0x9f);
  });
const post = async (path: string, to: string | null) => {
  next = to;
  const app = await boot(routes, ["a"]);
  return app.fetch(form(path, {}, { accept: "text/html" }));
};
const BAD = [
  "//evil.example",
  "//evil.example/x",
  "/\\evil.example",
  "/a\\b",
  "/a\u0000b",
  "/a\nb",
  "/a\u007fb",
  "\\\\x",
];

describe("k.server: an action's redirect stays on the origin", () => {
  it("an action returning a link that begins `//` or `/\\`, or holds a backslash or a control character, answers 500 `keel.unexpected` with no `location`", async () => {
    for (const to of BAD) {
      const res = await post("/item/x", to);
      expect(res.status, JSON.stringify(to)).toBe(500);
      expect(res.headers.get("location"), JSON.stringify(to)).toBeNull();
      expect(await res.text(), JSON.stringify(to)).toContain("keel.unexpected");
    }
  });

  it("an action returning `ok(null)` answers 303 to the request's own path as a relative path", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,8}$/), async (slug) => {
        const res = await post(`/item/${slug}`, null);
        expect(res.status).toBe(303);
        expect(res.headers.get("location")).toBe(`/item/${slug}`);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("for any returned link, a redirect's `location` is a same-origin path-absolute URL and any other answer has none", async () => {
    const link = fc.oneof(
      fc.constant(null),
      fc.string({ unit: "binary" }),
      fc.string({ unit: "binary" }).map((t) => `/${t}`),
      fc.string({ unit: "binary" }).map((t) => `//${t}`),
      fc.string({ unit: "binary" }).map((t) => `/\\${t}`),
      fc.stringMatching(/^[a-z0-9]{1,8}$/).map((slug) => c.href("a.item", { slug })),
    );
    const app = await boot(routes, ["a"]);
    await fc.assert(
      fc.asyncProperty(link, async (to) => {
        next = to;
        const res = await app.fetch(form("/item/x", {}, { accept: "text/html" }));
        const location = res.headers.get("location");
        if (res.status >= 300 && res.status < 400) {
          expect(location, JSON.stringify(to)).not.toBeNull();
          const at = location ?? "";
          expect(at.startsWith("/") && !at.startsWith("//") && !at.includes("\\") && !isControl(at)).toBe(true);
          expect(new URL(at, "http://localhost").origin).toBe("http://localhost");
        } else {
          expect(location, JSON.stringify(to)).toBeNull();
        }
      }),
      { seed: SEED, numRuns: 150 },
    );
  });
});
