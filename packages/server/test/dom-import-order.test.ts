// @vitest-environment node
// Server DOM import order (backlog 0128, red-team M4; principle 2): importing `@keel/runtime-dom/ops` or `@keel/ui`
// after `installServerDom` must not throw. The runtime registers its pre-resume event queue on `document` at import,
// so the server document accepts `addEventListener` (a no-op: the server fires no events). Each order runs in a
// fresh Node process, since module evaluation happens once per process.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL = pathToFileURL(path.join(pkg, "src/internal/dom/installServerDom.ts")).href;

const RENDER = `
const ui = await import("@keel/ui");
const el = ui.Box({ children: "x" });
if (el.nodeType !== 1 || typeof document.createElement !== "function") throw new Error("server DOM not in use");
console.log("ok");
`;

const run = (body: string): { status: number | null; out: string } => {
  const script = `const { installServerDom } = await import(${JSON.stringify(INSTALL)});\n${body}`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: pkg, encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}${r.stderr}`.trim() };
};

describe("server DOM import order", () => {
  it("backlog 0128 repro: installServerDom, then import @keel/runtime-dom/ops and @keel/ui", () => {
    const r = run(`installServerDom();\nawait import("@keel/runtime-dom/ops");\n${RENDER}`);
    expect(r.out).toBe("ok");
    expect(r.status).toBe(0);
  });

  it("import @keel/runtime-dom/ops and @keel/ui, then installServerDom", () => {
    const r = run(`await import("@keel/runtime-dom/ops");\nawait import("@keel/ui");\ninstallServerDom();\n${RENDER}`);
    expect(r.out).toBe("ok");
    expect(r.status).toBe(0);
  });
});
