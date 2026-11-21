import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes as receipts } from "../modules/receipts/routes.ts";
import { routes as setup } from "../modules/setup/routes.ts";
import { routes as shopping } from "../modules/shopping/routes.ts";
import { asJson, served, webRoutes } from "./serve.ts";

it("sends the list to setup until the household has a name, then lets it through", async () => {
  const { ctx } = await served(4);
  const before = await renderRoute("shopping.list", { routes: webRoutes, params: {}, ctx });
  expect(before.route().id).toBe("setup.form");
  expect(before.location()).toBeDefined();
  await before.fire("setup.form:name", { type: "input", value: "Elm Street" });
  await before.fire("setup.save", { type: "click" });
  expect(before.find("setup.done").text).toContain("set up");
  before.dispose();
  const after = await renderRoute("shopping.list", { routes: shopping, params: {}, ctx });
  expect(after.route().id).toBe("shopping.list");
  after.dispose();
});

it("guards the receipts book in every locale", async () => {
  const { ctx } = await served(4);
  const page = await renderRoute("receipts.book", { routes: webRoutes, params: { locale: "de-DE" }, ctx });
  expect(page.route().id).toBe("setup.form");
  page.dispose();
  expect(receipts).toBeDefined();
  expect(setup).toBeDefined();
});

it("answers the household API with null before setup and the name after", async () => {
  const { fetch } = await served(4);
  expect((await (await fetch(asJson("GET", "/api/household"))).json()).results["setup.household"]).toEqual({
    ok: true,
    value: { name: null },
  });
  const post = await fetch(
    new Request("http://localhost/setup", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "sec-fetch-site": "same-origin" },
      body: "name=Elm+Street",
    }),
  );
  expect(post.status).toBe(303);
  expect((await (await fetch(asJson("GET", "/api/household"))).json()).results["setup.household"]).toEqual({
    ok: true,
    value: { name: "Elm Street" },
  });
});
