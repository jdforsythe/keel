// @vitest-environment happy-dom
// Spec: k.router, clause "A guard returning err redirects to its redirect route with next; no loader or route component runs." Seed 1337.
import { beforeEach, describe, expect, it } from "vitest";
import { control, count, idOf, log, now, resetObservations, routes, settle, start, total } from "./fixtures.ts";

describe("k.router guards", () => {
  beforeEach(resetObservations);
  it("a guard returning err redirects to its redirect route with next; no loader runs and the route component never renders", async () => {
    const app = await start("/", { render: true });
    control.gate = false;
    await app.router.navigate(routes.href("secret.show", { id: idOf("5") }));
    await settle();
    expect(count("guard:auth")).toBe(1);
    expect(now(app.router)).toMatchObject({ id: "app.login", search: { next: expect.stringContaining("/secret/5") } });
    expect(app.history.current()).toContain("next=");
    expect(total("loader:")).toBe(0);
    expect(count("render:secret.show")).toBe(0);
    expect(app.host.querySelector('[data-page="secret.show"]')).toBeNull();
    expect(app.host.querySelector('[data-page="app.login"]')).not.toBeNull();
    app.stop();
  });
  it("a guard returning ok lets the route load and render (clean counterpart)", async () => {
    const app = await start("/", { render: true });
    await app.router.navigate(routes.href("secret.show", { id: idOf("5") }));
    await settle();
    expect(now(app.router)).toMatchObject({ id: "secret.show" });
    expect(count("loader:secret.show")).toBe(1);
    expect(app.host.querySelector('[data-page="secret.show"]')).not.toBeNull();
    app.stop();
  });
  it("every guard in the chain runs, outermost first, before any loader", async () => {
    const app = await start("/", { render: true });
    log.length = 0;
    await app.router.navigate(routes.href("guarded.page"));
    await settle();
    expect(log.filter((e) => e.startsWith("guard:") || e.startsWith("loader:"))).toEqual([
      "guard:g.outer",
      "guard:g.inner",
      "loader:guarded.page",
    ]);
    app.stop();
  });
});
