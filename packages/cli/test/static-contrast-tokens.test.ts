// k.a11y-static Tokens and Build: every command that runs the check pipeline reads the project's `tokens.ts`, fresh
// on every run; a broken one is E1807 at tokens.ts 1:1; `keel build` refuses a static a11y error.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { lsp, mcp } from "../src/index.ts";
import { a11yFindings } from "../src/internal/a11yFindings.ts";
import { readProject } from "../src/internal/readProject.ts";
import type { Io } from "../src/types/Io.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const BIN = join(ROOT, "packages", "cli", "src", "bin.ts");
const created: string[] = [];
afterAll(() => {
  for (const d of created) rmSync(d, { recursive: true, force: true });
});

const TOPOLOGY = `export default { api: { modules: ["m"], adapter: "node" } };\n`;
const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
const BRAND = `import { brandTokens } from "@keel/ui/brand";\nexport const tokens = brandTokens;\n`;
const comp = (body: string): string =>
  `import { Box, Text } from "@keel/ui";\nexport function C() {\n  return (\n${body}\n  );\n}\n`;
const PAIR = comp(`    <Box fg="divider" bg="card">\n      <Text>x</Text>\n    </Box>`);
const grays = (low: string): string =>
  `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens({ color: { low: "${low}", bg: "#ffffff" } });\n`;
const LOW = comp(`    <Box bg="bg">\n      <Text fg="low">x</Text>\n    </Box>`);

/** A temp project with every `@keel/*` package linked under its `node_modules`. */
function project(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-static-tokens-"));
  created.push(dir);
  const all = { "package.json": '{"name":"p","private":true,"type":"module"}\n', "topology.ts": TOPOLOGY, ...files };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  for (const pkg of readdirSync(join(ROOT, "packages")))
    symlinkSync(join(ROOT, "packages", pkg), join(dir, "node_modules", "@keel", pkg));
  return dir;
}
type Rec = Readonly<Record<string, unknown>>;
const keel = (dir: string, args: readonly string[]) => {
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], { cwd: dir, encoding: "utf8" });
  const records = r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l): Rec => JSON.parse(l));
  return { status: r.status, stdout: r.stdout, records };
};
const coded = (records: readonly Rec[], code: string) =>
  records.filter((r) => r.kind === "diag" && r.code === code).map((r) => `${String(r.path)}:${String(r.line)}`);
const io = (cwd: string): Io => ({
  cwd,
  load: (scope) => (scope === "none" || scope === "docs" ? [] : readProject(cwd, scope)),
});

describe("k.a11y-static: every check path reads tokens.ts", () => {
  const dir = project({ "modules/m/module.ts": MODULE, "modules/m/C.tsx": PAIR, "tokens.ts": BRAND });
  const want = ["modules/m/C.tsx:5"];

  it("keel check reports the E1804 of a fg set on the Box, at the Text", () => {
    const r = keel(dir, ["check"]);
    expect(coded(r.records, "E1804")).toEqual(want);
    expect(r.status).toBe(1);
  });

  it("keel build refuses it and writes nothing", () => {
    const r = keel(dir, ["build"]);
    expect(r.status).toBe(1);
    expect(coded(r.records, "E1804")).toEqual(want);
    expect(existsSync(join(dir, ".keel"))).toBe(false);
    expect(existsSync(join(dir, "dist"))).toBe(false);
  });

  it("MCP check reports the same E1804", async () => {
    const server = mcp(() => io(dir));
    const out = await server.receive(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "check", arguments: {} } })}\n`,
    );
    expect(out).toContain("E1804");
    expect(out).toContain("modules/m/C.tsx");
  });

  it("keel lsp publishes the same E1804 for the open file", async () => {
    const server = lsp(() => io(dir));
    const frame = (body: unknown): string => {
      const text = JSON.stringify(body);
      return `Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`;
    };
    await server.receive(
      frame({ jsonrpc: "2.0", id: 1, method: "initialize", params: { rootUri: pathToFileURL(dir).href } }),
    );
    const uri = pathToFileURL(join(dir, "modules/m/C.tsx")).href;
    const out = await server.receive(
      frame({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: { textDocument: { uri, languageId: "typescriptreact", version: 1, text: PAIR } },
      }),
    );
    expect(out).toContain("E1804");
  });

  it("the ledger's static findings hold the same E1804", async () => {
    const files = [...readProject(dir, "query"), { path: ".keel/routes.json", source: "{}" }];
    expect(await a11yFindings(dir, files)).toContainEqual({ code: "E1804", path: "modules/m/C.tsx" });
  });
});

describe("k.a11y-static Build: keel build refuses a static a11y error", () => {
  it.each([
    ["E1802", comp('    <Box as="nav" label="">\n      <Text>x</Text>\n    </Box>')],
    [
      "E1820",
      `import { Box, Button } from "@keel/ui";\nexport function C() {\n  return (\n    <Box direction="row-reverse">\n      <Button>a</Button>\n      <Button>b</Button>\n    </Box>\n  );\n}\n`,
    ],
  ])("%s stops keel build with exit 1 and nothing written", (code, source) => {
    const dir = project({ "modules/m/module.ts": MODULE, "modules/m/C.tsx": source, "tokens.ts": BRAND });
    const r = keel(dir, ["build"]);
    expect(r.status).toBe(1);
    expect(coded(r.records, code)).toHaveLength(1);
    expect(existsSync(join(dir, ".keel"))).toBe(false);
    expect(existsSync(join(dir, "dist"))).toBe(false);
  });
});

describe("k.a11y-static: a tokens.ts that gives no tokens is E1807", () => {
  it.each([
    ["exports no tokens", "export const other = {};\n"],
    ["throws", 'throw new Error("boom");\nexport const tokens = {};\n'],
    ["fails TokenSchema", 'import { defineTokens } from "@keel/ui";\nexport const tokens = { color: { fg: 5 } };\n'],
  ])("a tokens.ts that %s is one E1807 at tokens.ts 1:1, with no E1804", (_, source) => {
    const dir = project({ "modules/m/module.ts": MODULE, "modules/m/C.tsx": LOW, "tokens.ts": source });
    const r = keel(dir, ["check"]);
    const d = r.records.filter((x) => x.kind === "diag" && x.code === "E1807");
    expect(d).toEqual([expect.objectContaining({ path: "tokens.ts", line: 1, col: 1 })]);
    expect(String(d[0]?.message).length).toBeLessThanOrEqual(89);
    expect(coded(r.records, "E1804")).toEqual([]);
    expect(r.status).toBe(1);
  });

  it("no tokens.ts is neither E1807 nor E1804", () => {
    const dir = project({ "modules/m/module.ts": MODULE, "modules/m/C.tsx": LOW });
    const r = keel(dir, ["check"]);
    expect(coded(r.records, "E1807")).toEqual([]);
    expect(coded(r.records, "E1804")).toEqual([]);
  });
});

describe("k.a11y-static: a changed token is judged by the next check, cache or not", () => {
  it("changing a color in tokens.ts after a warm check reports the E1804 a cold run reports", () => {
    const dir = project({ "modules/m/module.ts": MODULE, "modules/m/C.tsx": LOW, "tokens.ts": grays("#111111") });
    expect(coded(keel(dir, ["check"]).records, "E1804")).toEqual([]);
    expect(existsSync(join(dir, "node_modules", ".cache", "keel"))).toBe(true);
    writeFileSync(join(dir, "tokens.ts"), grays("#787878"));
    const warm = keel(dir, ["check"]);
    expect(coded(warm.records, "E1804")).toEqual(["modules/m/C.tsx:5"]);
    rmSync(join(dir, "node_modules", ".cache", "keel"), { recursive: true, force: true });
    expect(keel(dir, ["check"]).stdout).toBe(warm.stdout);
  });

  it("a long-lived process judges a change to a file tokens.ts imports", async () => {
    const dir = project({
      "modules/m/module.ts": MODULE,
      "modules/m/C.tsx": LOW,
      "palette.ts": 'export const low = "#111111";\n',
      "tokens.ts": `import { defineTokens } from "@keel/ui";\nimport { low } from "./palette.ts";\nexport const tokens = defineTokens({ color: { low, bg: "#ffffff" } });\n`,
    });
    const server = mcp(() => io(dir));
    const call = () =>
      server.receive(
        `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "check", arguments: {} } })}\n`,
      );
    expect(await call()).not.toContain("E1804");
    writeFileSync(join(dir, "palette.ts"), 'export const low = "#787878";\n');
    expect(await call()).toContain("E1804");
  });
});
