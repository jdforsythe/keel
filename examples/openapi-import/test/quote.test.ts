import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import { routes } from "../modules/app/routes.ts";

const QUOTES = "http://localhost:4417/quotes/*";

it("shows the quote the imported client fetched", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route(QUOTES, () => Response.json({ id: "q1", text: "Small is fast.", author: "Ada" }));
  const page = await renderRoute("app.home", { routes, params: {}, ctx });
  expect(page.find("app.home.quote").text).toBe("Small is fast.");
  expect(page.find("app.home.author").text).toBe("Ada");
  page.dispose();
});

it("shows the error code when the service answers 404", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1 });
  ctx.net.route(QUOTES, () => Response.json({ message: "gone" }, { status: 404 }));
  const page = await renderRoute("app.home", { routes, params: {}, ctx });
  expect(page.find("app.home.author").text).toBe("api.status");
  page.dispose();
});
