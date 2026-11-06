// @vitest-environment happy-dom
// Match/Case: the discriminant is never inferred by reading `on` in the caller's scope (D25), and the
// JSX types narrow a Case's value by its tag (D26, checked by tsc over unsafe/jsx-match.tsx).
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { Case, Match, mount } from "../src/index.ts";
import { clone, template } from "../src/ops/index.ts";
import { rootSignal } from "./support.ts";

type State = { state: "loading" } | { state: "ready"; value: number };

describe("Match without a key", () => {
  it("does not read `on` in the caller's scope: changing it never re-runs the component", () => {
    const on = rootSignal<State>({ state: "loading" });
    const host = document.createElement("div");
    let renders = 0;
    const dispose = mount(() => {
      renders++;
      const d = document.createElement("div");
      d.appendChild(
        Match({
          get on() {
            return on.get();
          },
          children: [
            Case<State>({ tag: "loading", children: () => clone(template("<i>l</i>")) }),
            Case<State>({ tag: "ready", children: (v) => document.createTextNode(String(v.value)) }),
          ],
        }),
      );
      return d;
    }, host);
    expect(renders).toBe(1);
    expect(host.textContent).toBe("l");
    on.set({ state: "ready", value: 7 });
    on.set({ state: "loading" });
    on.set({ state: "ready", value: 8 });
    expect(host.textContent).toBe("8");
    expect(renders).toBe(1);
    dispose();
  });

  it("defaults the key to `state` for loading|error|ready cases, else `tag`", () => {
    const host = document.createElement("div");
    const dispose = mount(() => {
      const d = document.createElement("div");
      d.appendChild(
        Match({
          on: { tag: "b" },
          children: [
            Case<{ tag: "a" | "b" }>({ tag: "a", children: () => document.createTextNode("A") }),
            Case<{ tag: "a" | "b" }>({ tag: "b", children: () => document.createTextNode("B") }),
          ],
        }),
      );
      return d;
    }, host);
    expect(host.textContent).toBe("B");
    dispose();
  });
});

describe("Match/Case JSX types", () => {
  it("the fixture type-checks, including its expected-error lines", () => {
    const dir = path.resolve(import.meta.dirname, "..");
    const cfgPath = path.join(dir, "tsconfig.json");
    const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, dir);
    const file = path.join(dir, "unsafe/jsx-match.tsx");
    const program = ts.createProgram([file], parsed.options);
    const diags = ts.getPreEmitDiagnostics(program, program.getSourceFile(file));
    expect(diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
  });
});
