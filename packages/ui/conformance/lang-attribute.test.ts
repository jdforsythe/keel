// @vitest-environment happy-dom
// Spec: k.ui, clause "A base element given `lang="ja-JP"` has `lang="ja-JP"` in server and client output; without it, none." (rfc:0079)
// Seed 1337. The client-output half; the server-output half is packages/server/conformance/lang-attribute-server.test.ts.
// Select is not covered: its required props are not named by the spec section.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Box, Button, Checkbox, Heading, Image, Input, Link, Text, TextArea } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, home } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

type Make = (lang: string | undefined) => Node;
const withLang = (lang: string | undefined): { lang?: string } => (lang === undefined ? {} : { lang });

const makers: Record<string, Make> = {
  Box: (lang) => Box({ id: "x", ...withLang(lang), children: "b" }),
  Text: (lang) => Text({ id: "x", ...withLang(lang), children: "t" }),
  Heading: (lang) => Heading({ id: "x", level: 2, ...withLang(lang), children: "h" }),
  Button: (lang) => Button({ id: "x", ...withLang(lang), children: "go" }),
  Link: (lang) => Link({ id: "x", to: home, ...withLang(lang), children: "l" }),
  Image: (lang) => Image({ id: "x", alt: "logo", src: "logo.png", ...withLang(lang) }),
  Input: (lang) => Input({ id: "x", label: "Name", ...withLang(lang) }),
  TextArea: (lang) => TextArea({ id: "x", label: "Note", ...withLang(lang) }),
  Checkbox: (lang) => Checkbox({ id: "x", label: "Agree", ...withLang(lang) }),
};

const clientLang = (make: Make, lang: string | undefined): string | null => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = mount(() => make(lang), host, { ctx: simCtx });
  const value = document.getElementById("x")?.getAttribute("lang") ?? null;
  off();
  host.remove();
  return value;
};

describe("k.ui lang (client output)", () => {
  test('A base element given lang="ja-JP" has lang="ja-JP" in client output; without it, none', () => {
    for (const make of Object.values(makers)) {
      expect(clientLang(make, "ja-JP")).toBe("ja-JP");
      expect(clientLang(make, undefined)).toBeNull();
    }
  });

  test("property: any language tag given as lang is written unchanged as the lang attribute", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{2}-[A-Z]{2}$/), fc.constantFrom(...Object.keys(makers)), (t, name) => {
        const make = makers[name];
        if (make === undefined) throw new Error("fixture");
        expect(clientLang(make, t)).toBe(t);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
