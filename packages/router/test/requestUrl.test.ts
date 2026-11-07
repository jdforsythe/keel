// @vitest-environment happy-dom
// Examples (RFC 0027): in a client-only app the router gives every loader and action `url`, the absolute URL of the
// page (loader) or of the action's route (action), resolved against the document, so `*.server.ts` never reads
// `location`.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { absoluteUrl } from "../src/internal/absoluteUrl.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const P = s.object({ n: s.int() });
const Q = s.object({ tab: s.string().optional() });

it("loaders and actions get the absolute url of the page and of the action's route", async () => {
  const seen: string[] = [];
  const routes = manifest({
    "ru.page": {
      path: "/ru/:n",
      params: P,
      search: Q,
      loader: loader({ output: s.object({}), params: P, search: Q }, async ({ url }) => {
        seen.push(`load ${url}`);
        return ok({});
      }),
      actions: {
        POST: action({ input: s.object({}), params: P }, async (_input, { params, url }) => {
          seen.push(`act ${params.n} ${url}`);
          return ok(null);
        }),
      },
      component: () => Form({ method: "POST", action: to("/ru/7"), children: () => "go" }),
    },
  });
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/ru/7?tab=a") });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host);
  await settle();
  host.querySelector("form")?.requestSubmit();
  await settle();
  const page = new URL("/ru/7?tab=a", document.baseURI).href;
  expect(seen).toEqual([`load ${page}`, `act 7 ${new URL("/ru/7", document.baseURI).href}`, `load ${page}`]);
  unmount();
  router.dispose();
  host.remove();
});

it("absoluteUrl resolves against the document base, else http://localhost/", () => {
  expect(absoluteUrl("/a?b=1")).toBe(new URL("/a?b=1", document.baseURI).href);
  expect(new URL(absoluteUrl("/a")).pathname).toBe("/a");
});
