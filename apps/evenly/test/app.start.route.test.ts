import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";

it("greets the reader with a heading and a first step", async () => {
  const page = await renderRoute("app.start", { routes, params: {} });
  expect(page.route().id).toBe("app.start");
  expect(page.find("app.start.title").text).toBe("Evenly");
  expect(page.find("app.start.next").text).toContain("first cost");
  page.dispose();
});
