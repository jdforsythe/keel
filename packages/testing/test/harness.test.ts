// @vitest-environment happy-dom
// Spec: k.testing Harness (state seeding, fire settling) and a11y (accessible names per WAI-ARIA). Seed: 1337.
import { createCtx } from "@keel/ctx";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Editor, Names, Spin, notes, spinning } from "./support/components.ts";

const sim = () => createCtx({ mode: "sim", seed: 1337 });

describe("dispose restores seeded stores", () => {
  it("state after dispose equals state before render, for any seeded and fired text", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 }), async (seededText, typed) => {
        const before = notes.snapshot();
        const t = render(Editor, {
          props: {},
          state: [[notes, { text: seededText, focused: false, keys: [] }]],
          ctx: sim(),
        });
        await t.fire("ed.input", { type: "input", value: typed });
        expect(t.state(notes).text).toBe(typed);
        t.dispose();
        expect(notes.snapshot()).toEqual(before);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});

describe("fire settles deterministically", () => {
  it("work that never goes quiet rejects with keel.unexpected 'fire did not settle'", async () => {
    spinning.stop = false;
    const t = render(Spin, { props: {}, ctx: sim() });
    await expect(t.fire("spin.go", { type: "click" })).rejects.toThrow(/^keel\.unexpected fire did not settle/);
    spinning.stop = true;
    t.dispose();
  });
});

describe("accessible names (accname)", () => {
  it("a `for` label and a wrapping label both contribute, `for` first", () => {
    const t = render(Names, { props: {}, ctx: sim() });
    expect(t.find("nm.both").name).toBe("For Wrap");
    t.dispose();
  });

  it("aria-labelledby pointing at the element itself uses its aria-label, else its content, without recursing", () => {
    const t = render(Names, { props: {}, ctx: sim() });
    expect(t.find("nm.self").name).toBe("Own");
    expect(t.find("nm.selfspan").name).toBe("Span");
    t.dispose();
  });

  it("name from content applies only to roles that allow it", () => {
    const t = render(Names, { props: {}, ctx: sim() });
    expect(t.find("nm.para")).toMatchObject({ role: "paragraph", name: "", text: "Paragraph text" });
    expect(t.find("nm.head")).toMatchObject({ role: "heading", name: "Heading" });
    t.dispose();
  });
});
