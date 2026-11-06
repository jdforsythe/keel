// @vitest-environment happy-dom
// Spec: k.router Client prose (not a Conformance sentence): pending is true while a navigation is in flight and the previous page stays rendered until the new chain's loaders finish.
import { href } from "@keel/router";
import { beforeEach, describe, expect, it } from "vitest";
import { control, defer, now, resetObservations, settle, start } from "./fixtures.ts";

describe("k.router pending", () => {
  beforeEach(resetObservations);
  it("pending is true while a navigation is in flight and the previous page stays rendered until loaders finish", async () => {
    const app = await start("/", { render: true });
    const gate = defer();
    control.hold = gate.promise;
    const nav = app.router.navigate(href("slow.page"));
    await settle();
    expect(now(app.router).pending).toBe(true);
    expect(app.host.querySelector('[data-page="app.home"]')).not.toBeNull();
    expect(app.host.querySelector('[data-page="slow.page"]')).toBeNull();
    gate.resolve();
    await nav;
    await settle();
    expect(now(app.router)).toMatchObject({ id: "slow.page", pending: false });
    expect(app.host.querySelector('[data-page="slow.page"]')).not.toBeNull();
    expect(app.host.querySelector('[data-page="app.home"]')).toBeNull();
    app.stop();
  });
});
