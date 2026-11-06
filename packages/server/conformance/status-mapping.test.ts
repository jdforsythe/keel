// Clause: Status: keel.notFound 404 · keel.denied 403 · keel.fields 422 · other err 400 · uncaught throw 500 as keel.unexpected.
// Also request flow: guard deny redirects; search fails default; GET page markup; trailing slash 308.
import { describe, expect, it } from "vitest";
import { err, s } from "@keel/schema";
import { BASE, Boom, build, denied, fields, get, post } from "./fixtures.ts";

describe("k.server", () => {
  it("Status: a loader err with keel.denied yields 403", async () => {
    const { app } = await build({ show: () => Promise.resolve(err(denied.make({}))) });
    expect((await app.fetch(get("/orders/open"))).status).toBe(403);
  });

  it("Status: an action err with keel.fields yields 422", async () => {
    const { app } = await build({ act: () => err(fields.make({})) });
    const res = await app.fetch(post("/orders/open", { kind: "open", note: "n" }, { accept: "application/json" }));
    expect(res.status).toBe(422);
  });

  it("Status: any other err yields 400", async () => {
    const { app } = await build({ act: () => err(Boom.make({})) });
    const res = await app.fetch(post("/orders/open", { kind: "open", note: "n" }, { accept: "application/json" }));
    expect(res.status).toBe(400);
  });

  it("Status: an uncaught throw yields 500 as keel.unexpected", async () => {
    const { app } = await build({ show: () => Promise.reject(new Error("x")) });
    const res = await app.fetch(get("/orders/open", { accept: "application/json" }));
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("keel.unexpected");
  });

  it("Request flow: a guard deny redirects to its redirect route, with no loader run", async () => {
    const { app, n } = await build({ deny: true });
    const res = await app.fetch(get("/orders/open"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const loc = new URL(res.headers.get("location") ?? "", BASE);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).not.toBeNull();
    expect(n.show + n.shell + n.root).toBe(0);
  });

  it("Request flow: search that fails parsing falls back to defaults and the page renders 200", async () => {
    const { app } = await build({});
    const res = await app.fetch(get("/orders/open?tab=bogus&x=1"));
    expect(res.status).toBe(200);
  });

  it("A trailing slash redirects with 308 to the canonical path", async () => {
    const { app } = await build({});
    const res = await app.fetch(get("/orders/open/"));
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location") ?? "", BASE).pathname).toBe("/orders/open");
  });

  it("GET runs the matched chain and returns the page inside its layouts as HTML", async () => {
    const { app } = await build({});
    const res = await app.fetch(get("/orders/open"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");
    const body = await res.text();
    expect(body).toContain('id="app"');
    expect(body).toContain('id="orders"');
    expect(body).toContain('data-page="show"');
  });

  it("GET emits at most one k-state script and it holds valid JSON", async () => {
    const { app } = await build({});
    const body = await (await app.fetch(get("/orders/open"))).text();
    const scripts = [...body.matchAll(/<script type="application\/json" id="k-state">([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeLessThanOrEqual(1);
    for (const m of scripts) expect(() => JSON.parse(m[1] ?? "")).not.toThrow();
    expect(s).toBeDefined();
  });
});
