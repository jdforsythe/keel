import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { served, webRoutes } from "./serve.ts";

it("renders the start page with its heading and a link to the list", async () => {
  const { ctx, app } = await served(2, false);
  const page = await renderRoute("app.start", { routes: webRoutes, params: {}, ctx, app });
  expect(page.route().id).toBe("app.start");
  expect(page.find("app.start.heading").role).toBe("heading");
  expect(page.find("app.start.heading").text).toBe("Household");
  expect(page.find("app.start.intro").text).toContain("receipts book");
  expect(page.find("app.start.toList").role).toBe("link");
  expect(page.focusOrder()).toEqual([
    "app.nav.signIn",
    "app.nav.signUp",
    "app.start.toList",
    "app.start.toReceipts",
    "app.start.toSetup",
    "app.start.toProfile",
  ]);
  page.dispose();
});
