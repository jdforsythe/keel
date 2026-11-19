// k.topology Build and Calls and peers: a `node` deployable's `dist/<name>/routes.json` lists every module's routes,
// with a `client` deployable in the topology too, so the deployable forwards each path a `node` peer serves.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Real packages dir via a workspace link, so this also holds in Stryker's sandbox copy (where ../.. is not packages/).
const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
const saved = process.env.KEEL_DEPLOYABLE;

const write = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const page = (id: string): string => `export default function Page() { return ${JSON.stringify(id)}; }\n`;
const routesOf = (m: string): string => `import { manifest } from "@keel/router";
import Page from "./Page.tsx";
export const routes = manifest({ "${m}.show": { path: "/${m}", component: Page } });
`;

/** `data` of a `{ data, hash }` artifact file. */
const dataOf = (file: string): Record<string, unknown> => {
  const v: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  const data: unknown = typeof v === "object" && v !== null ? Reflect.get(v, "data") : undefined;
  if (typeof data !== "object" || data === null) throw new Error(`bad ${file}`);
  return Object.fromEntries(Object.entries(data));
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-node-routes-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  write(
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["w"], adapter: "client" }, api: { modules: ["a"], adapter: "node" }, more: { modules: ["b"], adapter: "node" } });\n',
  );
  for (const m of ["w", "a", "b"]) {
    write(`modules/${m}/Page.tsx`, page(m));
    write(`modules/${m}/routes.ts`, routesOf(m));
  }
  write(".keel/std.json", '{"data":{},"hash":"x"}\n');
  // The project build's table: the `client` deployable's routes alone.
  write(".keel/routes.json", '{"data":{"w.show":{"module":"w","path":"/w"}},"hash":"x"}\n');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
  else process.env.KEEL_DEPLOYABLE = saved;
});

describe("@keel/compiler/vite node deployable build", () => {
  it("writes dist/<name>/routes.json with every module's routes and copies std.json", { timeout: 30000 }, async () => {
    process.env.KEEL_DEPLOYABLE = "api";
    const made = keel().config({ root }, { command: "build" });
    const config = made !== null && "builder" in made ? made : undefined;
    const built: unknown[] = [];
    await config?.builder.buildApp({
      environments: { client: "client", ssr: "ssr" },
      // Vite's builds create the out dir.
      build: async (e) => {
        built.push(e);
        fs.mkdirSync(path.join(root, "dist", "api"), { recursive: true });
      },
    });
    expect(built).toEqual(["client", "ssr"]);
    const routes = dataOf(path.join(root, "dist", "api", "routes.json"));
    expect(Object.keys(routes).sort()).toEqual(["a.show", "b.show", "w.show"]);
    expect(Reflect.get(routes["b.show"] ?? {}, "path")).toBe("/b");
    expect(Reflect.get(routes["b.show"] ?? {}, "module")).toBe("b");
    expect(fs.readFileSync(path.join(root, "dist", "api", "std.json"), "utf8")).toBe('{"data":{},"hash":"x"}\n');
  });
});
