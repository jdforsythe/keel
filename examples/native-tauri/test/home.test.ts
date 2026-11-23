import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";

/** The Tauri shell's id in `topology.ts`. */
const id = "dev.keel.nativetauri";

it("renders the page as it runs in the Tauri shell", async () => {
  const page = await renderRoute("app.home", { routes, params: {}, shell: { id } });
  try {
    expect(page.find("app.home.title").text).toBe("One page in a Tauri shell");
    expect(page.a11y("app.home.title")).toMatchObject({ role: "heading" });
  } finally {
    page.dispose();
  }
});
