// @vitest-environment happy-dom
// k.mount, Testing "`renderRoute` and `resumeDocument` handles have `documents()`: the document navigations the page started, in order, `{ method, url, body }` (`body` the urlencoded text, `null` for a GET); none is made and the page stays."
// Seed 1337 (fc.assert below). The `resumeDocument` handle's `documents()` is read in packages/server/conformance/mount-placement.test.ts, where a served document exists.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { MOUNT_PATH, SEED, VALID, closeAll, mount, open, seen } from "./mount-pages.ts";

afterEach(closeAll);

const segment = fc.stringMatching(/^[A-Za-z0-9._~-]{1,6}$/).filter((v) => v !== "." && v !== "..");
const subpaths = fc.array(segment, { minLength: 1, maxLength: 3 }).map((parts) => `/${parts.join("/")}`);

describe("k.mount: documents() on a renderRoute handle", () => {
  it("a fresh handle has started no document navigation", async () => {
    const h = await open("mt.home");
    expect(h.documents()).toEqual([]);
    h.dispose();
  });

  it("each page load the page starts is one entry { method, url, body } in order, a GET with body null, for generated mount hrefs", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(subpaths, { minLength: 1, maxLength: 4 }), async (subs) => {
        const h = await open("mt.home");
        for (const sub of subs) await h.navigate(mount.href(sub));
        expect(h.documents()).toEqual(subs.map((sub) => ({ method: "GET", url: `${MOUNT_PATH}${sub}`, body: null })));
        h.dispose();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("a POST entry holds the urlencoded text of the body, and a link before it keeps its place in the order", async () => {
    const h = await open("mt.signin");
    await h.fire("mt.signin.email", { type: "input", value: VALID.email });
    await h.fire("mt.signin.password", { type: "input", value: VALID.password });
    await h.fire("mt.signin.submit", { type: "click" });
    expect(h.documents()).toEqual([
      { method: "POST", url: `${MOUNT_PATH}/sign-in/email`, body: "email=a%40b.example&password=pw" },
    ]);
    h.dispose();
  });

  it("none is made and the page stays: the location, the route and the rendered nodes are as they were", async () => {
    const h = await open("mt.home");
    const before = window.location.href;
    const loads = seen.loads;
    await h.fire("mt.home.github", { type: "click" });
    await h.navigate(mount.href("/x"));
    expect(h.documents()).toHaveLength(2);
    expect(window.location.href).toBe(before);
    expect(h.route().id).toBe("mt.home");
    expect(h.find("mt.home.title").text).toBe("home");
    expect(seen.loads).toBe(loads);
    h.dispose();
  });

  it("the entries a handle reads are a snapshot: reading them does not clear them", async () => {
    const h = await open("mt.home");
    await h.fire("mt.home.github", { type: "click" });
    expect(h.documents()).toHaveLength(1);
    expect(h.documents()).toHaveLength(1);
    h.dispose();
  });
});
