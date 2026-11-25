// @vitest-environment happy-dom
// k.claim, Order "At resume each op claims the next server element when it runs, so an element is made inside the build of what holds it: an `element` fill, a slot, a structural op, or a thunk or render function one of them calls. An element made before and passed in (eager) claims its parent's server element: its island mismatches (E1253) and re-renders. Compiled JSX keeps the order: component children compile to a thunk, element-valued props to getters (k.compiler)."
// k.claim, Client "The resume entry writes each warning `resume` returns to `console.warn`, one line, in every mode. An island whose client re-render places an element made before the op placing it started has an E1253 warning holding its island id and `made before its parent`."
// Spec: k.claim, clause "An island that mismatches under the resume entry writes one `console.warn` starting `E1253` with its id in production mode; with an eager child it holds `made before its parent`, with a template mismatch it does not."
// Seed: 1337 (no generated inputs). The entry text is the one `resumeEntry()` returns, run with the document of a real createApp response, a spied console.warn and the island components it names.
import { resumeEntry } from "@keel/compiler/internal/entry/resumeEntry";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import * as ops from "@keel/runtime-dom/ops";
import * as store from "@keel/store";
import { Button, Text } from "@keel/ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Component, click, componentsOf, install, q, serve } from "./resume-app.ts";
import { serveRoutes } from "./resume-graph-app.ts";
import { TWO } from "./resume-test-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

type Mode = "dev" | "production";

/** Runs the resume entry over the document in the page and returns every `console.warn` line it wrote. */
function runEntry(components: Record<string, Component>, mode: Mode): string[] {
  const text = resumeEntry().replace('const mode = "production"', `const mode = ${JSON.stringify(mode)}`);
  const lines: string[] = [];
  const warn = vi
    .spyOn(console, "warn")
    .mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(" ")));
  const quiet = (["error", "info", "debug", "log"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
  try {
    evaluate(text, {
      "@keel/compiler/std/bindClientStd": { bindClientStd: () => undefined },
      "@keel/ctx": { createCtx: () => createCtx({ mode: "sim", seed: 1337 }) },
      "@keel/runtime-dom/ops": ops,
      "@keel/store": store,
      "/@keel/islands.ts": { components },
    });
  } finally {
    warn.mockRestore();
    for (const spy of quiet) spy.mockRestore();
  }
  return lines;
}

const MISMATCH = (k: string): string => `import { signal } from "@keel/reactive";
export default function Page(props) {
  const n = signal(0);
  return <div id="${k}.root"><h3>{props.data.title}</h3><aside id="${k}.extra">extra</aside><button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="${k}.out">{n.get()}</span></div>
}
`;

const go = (): void => undefined;
function EagerIsland(): Node {
  const label = Text({ id: "ec.label", children: "go" });
  return Button({ id: "ec.btn", onClick: go, children: label });
}
const ecContract = contract("ec", {
  "ec.page": { path: "/ec" },
});

const EAGER = manifest(ecContract, {
  "ec.page": { component: EagerIsland },
});

describe("k.claim: the resume entry writes every resume warning to console.warn", () => {
  it("a production entry over a document with one mismatching island writes exactly one line, starting E1253 and holding the island id", async () => {
    install(await serve(TWO, "/two"));
    const lines = runEntry(componentsOf(TWO, { "ap.page": MISMATCH("ap") }), "production");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^E1253/);
    expect(lines[0]).toContain("ap.page");
    expect(lines[0]).not.toContain("\n");
  });

  it("two mismatching islands write two lines, one each", async () => {
    install(await serve(TWO, "/two"));
    const lines = runEntry(componentsOf(TWO, { "ap.page": MISMATCH("ap"), "al.layout": MISMATCH("al") }), "production");
    expect(lines).toHaveLength(2);
    expect(lines.filter((l) => l.startsWith("E1253"))).toHaveLength(2);
    expect(lines.some((l) => l.includes("ap.page"))).toBe(true);
    expect(lines.some((l) => l.includes("al.layout"))).toBe(true);
  });

  it("a clean document writes no line", async () => {
    install(await serve(TWO, "/two"));
    expect(runEntry(componentsOf(TWO), "production")).toEqual([]);
    await click("ap.inc");
    expect(q("ap.out").textContent).toBe("1");
  });

  it("a dev entry writes the same line for the same mismatching island", async () => {
    install(await serve(TWO, "/two"));
    const lines = runEntry(componentsOf(TWO, { "ap.page": MISMATCH("ap") }), "dev");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^E1253/);
    expect(lines[0]).toContain("ap.page");
  });

  for (const mode of ["dev", "production"] as const) {
    it(`an island whose component passes an eager element to a base element has a line holding \`made before its parent\` in ${mode}`, async () => {
      const doc = await serveRoutes(EAGER, ["ec"], "/ec", { mode });
      install(doc);
      const lines = runEntry({ "ec.page": EagerIsland }, mode);
      const e1253 = lines.filter((l) => l.startsWith("E1253"));
      expect(e1253).toHaveLength(1);
      expect(e1253[0]).toContain("ec.page");
      expect(e1253[0]).toContain("made before its parent");
    });
  }

  it("an island whose template differs from the server's, all thunks, has a line without `made before its parent`", async () => {
    install(await serve(TWO, "/two"));
    const lines = runEntry(componentsOf(TWO, { "ap.page": MISMATCH("ap") }), "production");
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("made before its parent");
  });
});
