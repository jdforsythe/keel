// @vitest-environment happy-dom
// k.privacy Server log: the dev body of a component that throws while rendering, with no errorElement and with one,
// holds the scrubbed thrown text clipped after the scrub, so a secret that the 89-character clip would cut leaves no
// part of itself. Seed 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, reveal, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const T = "tok-5e4d3c2b1a0f9e8d";
const Out = s.object({ t: s.string() });

async function run(url: string, lead: number) {
  const LEAD = "x".repeat(lead);
  const lines: string[] = [];
  // The loader reveals a secret and passes its text down; the component throws it at the 89-character clip.
  const c = contract("app", { "app.c": { path: "/c" }, "app.e": { path: "/e" } });
  const passed = async () => {
    const m = s.secret(s.string()).parse(T);
    return ok({ t: m.ok ? reveal(m.value) : "" });
  };
  const routes = manifest(c, {
    "app.c": {
      loader: loader(c, "app.c", { output: Out }, passed),
      component: (p: { readonly data: { readonly t: string } }) => {
        throw new Error(`${LEAD} ${p.data.t}`);
      },
    },
    "app.e": {
      loader: loader(c, "app.e", { output: Out }, passed),
      component: (p: { readonly data: { readonly t: string } }) => {
        throw new Error(`${LEAD} ${p.data.t}`);
      },
      errorElement: () => document.createElement("section"),
    },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  const res = await app.fetch(new Request(`http://localhost${url}`, { headers: { accept: "text/html" } }));
  const body = await res.text();
  await app.close();
  return { body, lines };
}

describe("the dev body of a render throw", () => {
  for (const url of ["/c", "/e"])
    it(`at ${url} holds no clipped part of a secret, wherever the clip falls`, async () => {
      for (let lead = 0; lead <= 120; lead += 3) {
        const { body, lines } = await run(url, lead);
        if (lead === 0) expect(body).toContain("[secret]");
        expect(body).not.toContain("tok-5");
        expect(lines.join("\n")).not.toContain("tok-5");
      }
    });
});
