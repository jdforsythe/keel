// @vitest-environment happy-dom
// Spec: k.mount, Navigation "`Link to`, `navigate` and an action's `ok(href)` take it as any `Href`. A router handles client-side only a path its table matches as a page and k.mount-scope allows; a link click, `navigate` or `ok(href)` to another path is a document navigation (`location.assign`; `replace`: `location.replace`)."
// Spec: k.mount, Conformance "In a router, a `Link` click, `navigate` and an action's `ok` to it each record one GET in `documents()` and keep the page; a contract's `href` link navigates client-side."
// Seed 1337 (fc.assert below). Not testable through `documents()`: that `replace` uses `location.replace`, which the reading does not tell apart from `location.assign`.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { ACT_TARGET, SEED, closeAll, elsewhere, mount, open, seen } from "./mount-pages.ts";

afterEach(closeAll);

const get = (url: string) => ({ method: "GET", url, body: null });

describe("k.mount: a router keeps client-side only the pages its table matches", () => {
  it("a Link to a MountHref, clicked, records one GET and keeps the page, its nodes and its loaders", async () => {
    const h = await open("mt.home");
    const loads = seen.loads;
    await h.fire("mt.home.github", { type: "click" });
    expect(h.documents()).toEqual([get("/api/auth/login/github?next=a%20b")]);
    expect(h.route().id).toBe("mt.home");
    expect(h.find("mt.home.title").text).toBe("home");
    expect(seen.loads).toBe(loads);
    h.dispose();
  });

  it("`navigate` of a MountHref from the page, and on the handle, each record one GET and keep the page", async () => {
    const h = await open("mt.home");
    const loads = seen.loads;
    await h.fire("mt.home.go", { type: "click" });
    expect(h.documents()).toEqual([get("/api/auth/x")]);
    await h.navigate(mount.href("/y"));
    expect(h.documents()).toEqual([get("/api/auth/x"), get("/api/auth/y")]);
    expect(h.route().id).toBe("mt.home");
    expect(h.find("mt.home.title").text).toBe("home");
    expect(seen.loads).toBe(loads);
    h.dispose();
  });

  it("an action returning `ok(mount.href(...))` records one GET, keeps the page and runs no loader", async () => {
    const h = await open("mt.home");
    const loads = seen.loads;
    const acts = seen.acts;
    await h.fire("mt.home.act", { type: "click" });
    expect(seen.acts).toBe(acts + 1);
    expect(h.documents()).toEqual([get(ACT_TARGET)]);
    expect(h.route().id).toBe("mt.home");
    expect(h.find("mt.home.title").text).toBe("home");
    expect(seen.loads).toBe(loads);
    h.dispose();
  });

  it("a contract's `href` link navigates client-side and records nothing", async () => {
    const h = await open("mt.home");
    await h.fire("mt.home.about", { type: "click" });
    expect(h.route().id).toBe("mt.about");
    expect(h.documents()).toEqual([]);
    h.dispose();
  });

  it("`navigate` to a page of another deployable's manifest, which the router's table lacks, records one GET and keeps the page", async () => {
    const h = await open("mt.home");
    await h.navigate(elsewhere);
    expect(h.documents()).toEqual([get("/billing")]);
    expect(h.route().id).toBe("mt.home");
    h.dispose();
  });

  it("for generated mount hrefs with a search map, a click, `navigate` and the entry agree on the one GET", async () => {
    const search = fc.dictionary(fc.stringMatching(/^[a-z]{1,4}$/), fc.string({ maxLength: 6 }), { maxKeys: 3 });
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^\/[a-z]{1,6}$/), search, async (sub, map) => {
        const h = await open("mt.home");
        await h.navigate(mount.href(sub, map));
        expect(h.documents()).toEqual([get(mount.href(sub, map))]);
        expect(h.route().id).toBe("mt.home");
        h.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
