import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";

it("renders the home page in the browser with no server", async () => {
  const page = await renderRoute("app.home", { routes, params: {} });
  expect(page.find("app.home.title").text).toBe("Static files only");
  page.dispose();
});
