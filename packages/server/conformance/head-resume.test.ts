// @vitest-environment happy-dom
// Spec: k.head, clause "After `resume` of a served document, `document.title` and `lang` equal the served document's." (rfc:0079) Seed 1337.
// The served document comes from createApp; its head and `<html lang>` are copied into the test document, its body is resumed with the public `resume` (as route-of-base-elements-island.test.ts does).
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { resume } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { Box, Button } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";

const SEED = 1337;
const ctx = createCtx({ mode: "sim", seed: SEED });
const Locale = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
const island = (): Node => Box({ children: () => Button({ id: "h.go", onClick: () => undefined, children: "Go" }) });
const h = contract("h", {
  "h.island": { path: "/:locale/x", params: s.object({ locale: Locale }) },
});

const routes = manifest(h, {
  "h.island": { component: island, title: (props) => `Island ${String(Reflect.get(Object(props.params), "locale"))}` },
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.head resume", () => {
  test("After `resume` of a served document, `document.title` and `lang` equal the served document's.", async () => {
    const app = await createApp({
      topology: topology({ web: { modules: ["h"], adapter: "node" } }),
      routes,
      ctx,
      mode: "production",
    });
    await fc.assert(
      fc.asyncProperty(fc.constantFrom<"en-US" | "de-DE">("en-US", "de-DE"), async (locale) => {
        const res = await app.fetch(new Request(`http://localhost${String(h.href("h.island", { locale }))}`));
        expect(res.status).toBe(200);
        const served = new DOMParser().parseFromString(await res.text(), "text/html");
        for (const sc of served.body.querySelectorAll("script[type=module]")) sc.remove();
        const title = served.title;
        const lang = served.documentElement.getAttribute("lang") ?? "";
        expect([title, lang]).toEqual([`Island ${locale}`, locale]);
        document.title = title;
        document.documentElement.lang = lang;
        document.body.innerHTML = served.body.innerHTML;
        resume(document.body, { "h.island": island }, { ctx });
        expect(document.title).toBe(title);
        expect(document.documentElement.lang).toBe(lang);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});
