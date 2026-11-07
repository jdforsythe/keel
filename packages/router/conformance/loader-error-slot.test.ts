// @vitest-environment happy-dom
// Spec: k.router, clause "A loader err renders the nearest errorElement in the chain; layouts above it stay rendered." Seed 1337.
import { href } from "@keel/router";
import { beforeEach, describe, expect, it } from "vitest";
import { control, idOf, resetObservations, settle, start } from "./fixtures.ts";

describe("k.router loader errors", () => {
  beforeEach(resetObservations);
  it("a loader err renders the nearest errorElement in the chain; layouts above it stay rendered", async () => {
    const app = await start("/", { render: true });
    control.show = "err";
    await app.router.navigate(href("orders.show", { id: idOf("7") }, {}));
    await settle();
    const shown = app.host.querySelector('[data-error="orders.show"]');
    expect(shown?.getAttribute("data-code")).toBe("orders.locked");
    expect(app.host.querySelector('[data-error="orders.shell"]')).toBeNull();
    expect(app.host.querySelector('[data-page="orders.show"]')).toBeNull();
    expect(app.host.querySelector('[data-layout="app.shell"]')).not.toBeNull();
    expect(app.host.querySelector('[data-layout="orders.shell"]')).not.toBeNull();
    const layout = app.host.querySelector('[data-layout="orders.shell"]');
    expect(layout?.contains(shown ?? null)).toBe(true);
    expect(app.host.querySelector('[data-layout="app.shell"]')?.contains(layout ?? null)).toBe(true);
    app.stop();
  });
  it("when the failing route has no errorElement, the nearest layout errorElement renders and layouts above it stay", async () => {
    const app = await start("/", { render: true });
    await app.router.navigate(href("orders.bare"));
    await settle();
    const shown = app.host.querySelector('[data-error="orders.shell"]');
    expect(shown?.getAttribute("data-code")).toBe("orders.broken");
    expect(app.host.querySelector('[data-page="orders.bare"]')).toBeNull();
    expect(app.host.querySelector('[data-layout="app.shell"]')).not.toBeNull();
    expect(app.host.querySelector('[data-layout="app.shell"]')?.contains(shown ?? null)).toBe(true);
    app.stop();
  });
  it("a loader ok renders the route component and no errorElement (clean counterpart)", async () => {
    const app = await start("/", { render: true });
    await app.router.navigate(href("orders.show", { id: idOf("7") }, {}));
    await settle();
    expect(app.host.querySelector("[data-error]")).toBeNull();
    expect(app.host.querySelector('[data-page="orders.show"]')).not.toBeNull();
    app.stop();
  });
});
