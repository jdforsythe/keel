// @vitest-environment happy-dom
// Spec: k.ui, clause "A base element given `lang=\"ja-JP\"` has `lang=\"ja-JP\"` in server and client output; without it, none." (rfc:0079)
// Seed 1337. The server-output half; the client half is packages/ui/conformance/lang-attribute.test.ts.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { Box, Button, Heading, Image, Input, Text } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
type Make = (lang: string | undefined) => Node;
const withLang = (lang: string | undefined): { lang?: string } => (lang === undefined ? {} : { lang });
const makers: Record<string, Make> = {
  Box: (lang) => Box({ id: "x", ...withLang(lang), children: "b" }),
  Text: (lang) => Text({ id: "x", ...withLang(lang), children: "t" }),
  Heading: (lang) => Heading({ id: "x", level: 2, ...withLang(lang), children: "h" }),
  Button: (lang) => Button({ id: "x", ...withLang(lang), children: "go" }),
  Image: (lang) => Image({ id: "x", alt: "logo", src: "logo.png", ...withLang(lang) }),
  Input: (lang) => Input({ id: "x", label: "Name", ...withLang(lang) }),
};

const serverLang = async (make: Make, lang: string | undefined): Promise<string | null> => {
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({ "app.home": { path: "/", component: () => make(lang) } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
  });
  const res = await app.fetch(new Request("http://localhost/"));
  const tpl = document.createElement("template");
  tpl.innerHTML = await res.text();
  return tpl.content.getElementById("x")?.getAttribute("lang") ?? null;
};

describe("k.ui lang (server output)", () => {
  test('A base element given lang="ja-JP" has lang="ja-JP" in server output; without it, none', async () => {
    for (const make of Object.values(makers)) {
      expect(await serverLang(make, "ja-JP")).toBe("ja-JP");
      expect(await serverLang(make, undefined)).toBeNull();
    }
  });

  test("property: any language tag given as lang is written unchanged in server output", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{2}-[A-Z]{2}$/),
        fc.constantFrom(...Object.keys(makers)),
        async (t, name) => {
          const make = makers[name];
          if (make === undefined) throw new Error("fixture");
          expect(await serverLang(make, t)).toBe(t);
        },
      ),
      { seed: SEED, numRuns: 10 },
    );
  });
});
