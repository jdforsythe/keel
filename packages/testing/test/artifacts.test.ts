// @vitest-environment happy-dom
// Spec: k.testing a11y and Rules E1702 (rendered role or name source differs from a11y.json). Seed: 1337.
import type { A11yEntry } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { Editor, Names, Toggle, notes } from "./support/components.ts";

const sim = () => createCtx({ mode: "sim", seed: 1337 });
const a11y = (entries: Record<string, A11yEntry>) => ({ "a11y.json": entries });
const editorState = [[notes, { text: "", focused: false, keys: [] }]] as const;

// Hand-built `.keel/a11y.json` for the Editor fixture (what the compiler would emit for its template).
const matching = a11y({
  "ed.form": { role: "form", name: "none", tag: "form" },
  "ed.input": { role: "textbox", name: "label", tag: "input" },
  "ed.boom": { role: "button", name: "text", tag: "button" },
  "ed.out": { role: "paragraph", name: "none", tag: "p" },
});

describe("E1702: rendered role and name source are compared with a11y.json", () => {
  it("a render matching a11y.json passes, and so does every fire", async () => {
    const t = render(Editor, { props: {}, state: editorState, ctx: sim(), artifacts: matching });
    await t.fire("ed.input", { type: "input", value: "x" });
    t.dispose();
  });

  it("a different role fails with E1702 naming the id, expected and rendered", () => {
    const artifacts = a11y({ ...matching["a11y.json"], "ed.boom": { role: "link", name: "text", tag: "a" } });
    expect(() => render(Editor, { props: {}, state: editorState, ctx: sim(), artifacts })).toThrow(
      /^E1702 "ed\.boom" expected role link, name from text; rendered role button, name from text/,
    );
  });

  it("a different name source fails with E1702; a null role checks the source only", () => {
    const artifacts = a11y({ "nm.self": { role: null, name: "text", tag: "button" } });
    expect(() => render(Names, { props: {}, ctx: sim(), artifacts })).toThrow(
      /^E1702 "nm\.self" expected any role, name from text; rendered role button, name from aria/,
    );
  });

  it("without artifacts nothing is compared; ids absent from a11y.json are skipped", () => {
    render(Names, { props: {}, ctx: sim() }).dispose();
    render(Names, {
      props: {},
      ctx: sim(),
      artifacts: a11y({ other: { role: "x", name: "aria", tag: "p" } }),
    }).dispose();
  });

  it("a mismatch reached through fire rejects with E1702", async () => {
    const artifacts = a11y({ "tg.btn": { role: "button", name: "text", tag: "button" } });
    const t = render(Toggle, { props: {}, ctx: sim(), artifacts });
    await expect(t.fire("tg.btn", { type: "click" })).rejects.toThrow(
      /^E1702 "tg\.btn" expected role button, name from text; rendered role button, name from aria/,
    );
    t.dispose();
  });
});
