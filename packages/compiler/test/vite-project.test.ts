// The Vite plugin's project inputs (D24-D25): tokens.ts -> keel.css, routes.ts -> routes.json, topology.ts ->
// E1004 exemption and the generated client entry. The temp app links the workspace packages the way pnpm does.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { parseSync } from "oxc-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Real packages dir via a workspace link, so this also holds in Stryker's sandbox copy (where ../.. is not packages/).
const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";

const write = (rel: string, text: string): string => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
};

const artifact = (name: string): Record<string, unknown> => {
  const v: unknown = JSON.parse(fs.readFileSync(path.join(root, ".keel", name), "utf8"));
  const data = typeof v === "object" && v !== null ? Reflect.get(v, "data") : undefined;
  if (typeof data !== "object" || data === null) throw new Error(`bad ${name}`);
  return Object.fromEntries(Object.entries(data));
};

const PAGE = `import { Box, Text } from "@keel/ui";
import { board } from "./board.ts";
export default function ListsPage() {
  return <Box as="main" p={{ base: "2", md: "3" }} bg="bg" states={{ hover: { bg: "accent" } }}>
    <Text fg="fg">{String(board.get("n"))}</Text>
  </Box>;
}
`;
const ROUTES = `import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import ListsPage from "./ListsPage.tsx";
import { loadList } from "./loadList.server.ts";
export const routes = manifest({
  "todos.index": { path: "/", component: ListsPage },
  "todos.list": { path: "/lists/:listId", params: s.object({ listId: s.string() }), loader: loadList, component: ListsPage },
});
`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-project-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  write(
    "tokens.ts",
    `import { defineTokens } from "@keel/ui";
export const tokens = defineTokens({
  color: { fg: { light: "#111", dark: "#eee" }, bg: { light: "#fff", dark: "#111" }, accent: "#0a5" },
  space: { 1: "4px", 2: "8px", 3: "16px" },
  breakpoint: { md: "768px" },
});
`,
  );
  write(
    "topology.ts",
    `import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["todos"], adapter: "client" } });\n`,
  );
  write(
    "modules/todos/board.ts",
    `import { store } from "@keel/store";\nimport { s } from "@keel/schema";\nexport const board = store(s.object({ n: s.int() }), { n: 0 });\n`,
  );
  write("modules/todos/ListsPage.tsx", PAGE);
  write(
    "modules/todos/loadList.server.ts",
    `import { loader } from "@keel/router";\nimport { ok, s } from "@keel/schema";\nexport const loadList = loader({ output: s.object({ n: s.int() }) }, async () => ok({ n: 1 }));\n`,
  );
  write("modules/todos/routes.ts", ROUTES);
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("@keel/compiler/vite project inputs", () => {
  it("emits routes.json, styles.json, keel.css and the client entry", { timeout: 30000 }, async () => {
    const warnings: string[] = [];
    const p = keel();
    p.configResolved({ root, command: "build" });
    await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
    expect(warnings).toEqual([]);

    const routes = artifact("routes.json");
    expect(Object.keys(routes)).toEqual(["todos.index", "todos.list"]);
    expect(routes["todos.list"]).toMatchObject({ path: "/lists/:listId", module: "todos", layout: null, actions: [] });
    expect(artifact("styles.json").usages).toContainEqual({ breakpoint: "md", props: { p: "3" } });
    expect(fs.readdirSync(path.join(root, ".keel")).sort()).toEqual([
      "a11y.json",
      "deps.json",
      "ids.json",
      "routes.json",
      "std.json",
      "styles.json",
    ]);

    const cssId = p.resolveId("virtual:keel.css");
    expect(cssId).not.toBeNull();
    const css = (await p.load(cssId ?? "")) ?? "";
    expect(css).toContain(":root{");
    expect(css).toContain("@media (min-width: 768px)");
    const page = p.transform(PAGE, path.join(root, "modules/todos/ListsPage.tsx"))?.code ?? "";
    const classes = [...page.matchAll(/class: "([^"]+)"/g)].flatMap((m) => (m[1] ?? "").split(" "));
    expect(classes).toEqual(["k-p-2", "k-md-p-3", "k-bg-bg", "k-hover-bg-accent", "k-fg-fg"]);
    for (const c of classes) expect(css).toContain(`.${c}`);

    expect(p.resolveId("/@keel/entry.ts")).toBe("/@keel/entry.ts");
    const entry = (await p.load("/@keel/entry.ts")) ?? "";
    expect(entry).toContain('import "virtual:keel.css";');
    expect(entry).toContain('from "/modules/todos/routes.ts"');
    expect(entry).toContain('createCtx({ mode: "real" })');
    expect(entry).toContain("createRouter(__keelRoutes0, { ctx, history: browserHistory() })");
    expect(entry).toContain("mount(router.App, el, { ctx })");
    expect(parseSync("entry.js", entry, { sourceType: "module" }).errors).toEqual([]);
  });

  it("exempts client deployables from E1004 and reports it again after topology.ts changes", async () => {
    const p = keel();
    p.configResolved({ root });
    const file = path.join(root, "modules/todos/routes.ts");
    // topology.ts is read in configResolved, so transforms before buildStart already see it
    expect(p.transform(ROUTES, file)?.code).toContain("manifest(");
    const topo = write("topology.ts", `export default topology({ web: { modules: ["todos"], adapter: "static" } });\n`);
    p.watchChange(topo, { event: "update" });
    expect(() => p.transform(ROUTES, file)).toThrow(/^E1004 modules\/todos\/routes.ts/);
    await expect(p.load("/@keel/entry.ts")).rejects.toThrow(/needs a client deployable/);
  });

  it("warns about unknown tokens and still emits the CSS of the known ones", { timeout: 30000 }, async () => {
    write("modules/todos/Bad.tsx", `import { Box } from "@keel/ui";\nexport default () => <Box bg="nope" p="1" />;\n`);
    const warnings: string[] = [];
    const p = keel();
    p.configResolved({ root, command: "build" });
    await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
    expect(warnings.some((w) => /E1801/.test(w) && w.includes("nope"))).toBe(true);
    expect((await p.load("/__keel.css")) ?? "").toContain(".k-p-1{");
  });
});
