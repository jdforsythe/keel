// @vitest-environment happy-dom
// @vitest-environment-options {"url": "http://localhost/"}
// The ops home page as a person meets it, served by the `sessions` deployable and resumed in the browser, with the
// render checks of k.a11y run against the project's `a11y.json` and tokens: roles, contrast and focus order.
import { createCtx } from "@keel/ctx";
import { routeTable } from "@keel/router";
import { createApp } from "@keel/server";
import { record } from "@keel/std-sessions";
import { routes as sessionsRoutes } from "@keel/std-sessions/routes";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/ops/routes.ts";
import topology from "../topology.ts";
import { artifacts } from "./artifacts.ts";

it("is one main landmark with a heading and one button that shows and hides the limits", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const app = await createApp({ topology, deployable: "sessions", routes: routeTable(routes, sessionsRoutes), ctx });
  const page = await renderRoute("ops.home", { routes, ctx, app, artifacts });
  try {
    expect(page.find("ops.home").role).toBe("main");
    expect(page.find("ops.home.endpoint").text).toBe("http://localhost/sessions");
    // The button is the page's one keyboard stop, and its name says what pressing it does.
    expect(page.focusOrder()).toEqual(["ops.home.limits"]);
    expect(page.find("ops.home.limits")).toMatchObject({ role: "button", name: "Show limits" });
    expect(page.find("ops.home.limits.list").text).toBe("");
    await page.fire("ops.home.limits", { type: "click" });
    expect(page.find("ops.home.limits").name).toBe("Hide limits");
    expect(page.find("ops.home.limits.list").text).toContain("Archive size");
  } finally {
    page.dispose();
    record(ctx).stop();
  }
});
