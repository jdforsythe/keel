// Spec: std.headless, clause "A key `a b` or a repeated key throws E2801."
// Seed: 1337.
// std.headless, Rules "E2801 an option, tab or toast key that is not 1 to 64 of `[A-Za-z0-9_-]` or repeats in its widget (thrown at render)."
// @vitest-environment happy-dom
// Assumptions: the thrown error carries `code: "E2801"`; every key-taking widget (Listbox, Combobox, Menu, Tabs, Toaster) is checked on its keys at its first render.
import type { Ctx } from "@keel/ctx";
import { Combobox, Listbox, Menu, Tabs, Toaster } from "@keel/std-headless";
import { render } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, page, simCtx, thrownSync } from "./fixtures.ts";

// A throw at render surfaces through the harness's root Boundary as `keel.unexpected` carrying the thrown message (k.errors),
// so the E-code is read from the message.
const codeOf = (e: unknown): string | undefined => (e instanceof Error ? /\bE\d{4}\b/.exec(e.message)?.[0] : undefined);

const options = (keys: readonly string[]) => keys.map((key) => ({ key, text: `Item ${key.length}` }));

const widgets: [string, (keys: readonly string[], c: Ctx) => Node][] = [
  [
    "Listbox",
    (keys, c) =>
      Listbox(
        {
          id: "kw",
          label: "Items",
          options: () => options(keys),
          mode: "single",
          selected: () => [],
          onChange: () => {},
        },
        c,
      ),
  ],
  [
    "Combobox",
    (keys, c) =>
      Combobox(
        {
          id: "kw",
          label: "Items",
          text: () => "",
          onInput: () => {},
          options: () => options(keys),
          onChange: () => {},
        },
        c,
      ),
  ],
  [
    "Menu",
    (keys, c) => Menu({ id: "kw", trigger: () => "Actions", items: () => options(keys), onSelect: () => {} }, c),
  ],
  [
    "Tabs",
    (keys, c) =>
      Tabs(
        {
          id: "kw",
          label: "Items",
          tabs: () => options(keys),
          selected: () => keys[0] ?? "",
          onChange: () => {},
          panel: (k) => `Panel ${k.length}`,
        },
        c,
      ),
  ],
  [
    "Toaster",
    (keys, c) =>
      Toaster(
        {
          id: "kw",
          items: () => keys.map((id) => ({ id, text: "Saved", tone: "status" as const })),
          onDismiss: () => {},
          dismiss: "Dismiss",
          duration: 5000,
        },
        c,
      ),
  ],
];

const run = (make: (keys: readonly string[], c: Ctx) => Node, keys: readonly string[]) =>
  thrownSync(() =>
    render(
      page((c) => make(keys, c)),
      { props: {}, ctx: simCtx() },
    ).dispose(),
  );

const keyChar = fc.constantFrom(..."abcxyzABCXYZ0189_-");
const validKey = fc.array(keyChar, { minLength: 1, maxLength: 64 }).map((cs) => cs.join(""));
const badKey = fc.oneof(
  fc
    .tuple(
      fc.array(keyChar, { maxLength: 10 }),
      fc.constantFrom(" ", ".", ":", "/", "é", "<", "#", "\n"),
      fc.array(keyChar, { maxLength: 10 }),
    )
    .map(([a, bad, b]) => `${a.join("")}${bad}${b.join("")}`),
  fc.constant(""),
  fc.array(keyChar, { minLength: 65, maxLength: 70 }).map((cs) => cs.join("")),
);

describe("std.headless: E2801 keys", () => {
  for (const [name, make] of widgets) {
    test(`${name}: a key \`a b\` throws E2801`, () => {
      const e = run(make, ["ok", "a b"]);
      expect(codeOf(e)).toBe("E2801");
    });

    test(`${name}: a repeated key throws E2801`, () => {
      expect(codeOf(run(make, ["one", "two", "one"]))).toBe("E2801");
    });
  }

  test("E2801 an option, tab or toast key that is not 1 to 64 of `[A-Za-z0-9_-]` throws at render (property)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...widgets), badKey, ([, make], bad) => {
        expect(codeOf(run(make, ["fine", bad]))).toBe("E2801");
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("E2801 does not fire for distinct keys of 1 to 64 of `[A-Za-z0-9_-]` (property)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...widgets),
        fc.uniqueArray(validKey, { minLength: 1, maxLength: 4 }),
        ([, make], keys) => {
          expect(run(make, keys)).toBeUndefined();
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });
});
