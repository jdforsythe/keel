import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";
import { artifacts } from "./artifacts.ts";

it("renders the home page in the browser with no server", async () => {
  const page = await renderRoute("app.home", { routes, params: {}, artifacts });
  try {
    expect(page.find("app.home.title").text).toBe("Static files only");
    // A screen reader user lands on one named level-1 heading; nothing on the page takes focus.
    expect(page.a11y("app.home.title")).toMatchObject({ role: "heading", name: "Static files only" });
    expect(page.focusOrder()).toEqual([]);
  } finally {
    page.dispose();
  }
});
