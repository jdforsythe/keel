// `keel build` of a `static` deployable (k.hosting Static, k.topology Declaration): a topology with no `client` or
// `node` deployable serves the first `static` one's resume entry; a `static` build writes no `index.html`, builds its
// client entry into `dist/<name>/` and its build entry (exporting `render`) outside `dist/`; a build error with no
// deployable to serve names the fix.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resumeEntry } from "../src/entry/resumeEntry.ts";
import { indexHtml } from "../src/internal/indexHtml.ts";
import { noDeployable } from "../src/internal/noDeployable.ts";
import keel from "../src/vite.ts";

const made: string[] = [];
const saved = process.env.KEEL_DEPLOYABLE;
afterEach(() => {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
  else process.env.KEEL_DEPLOYABLE = saved;
});
const project = (top: string | undefined): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-static-"));
  made.push(d);
  if (top !== undefined) fs.writeFileSync(path.join(d, "topology.ts"), `export default topology(${top})\n`);
  return d;
};
const STATIC = `{ web: { modules: ["app"], adapter: "static" } }`;

describe("a static deployable's build", () => {
  it("serves the static deployable's resume entry, with no KEEL_DEPLOYABLE", async () => {
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    const p = keel();
    p.configResolved({ root: project(STATIC), command: "build" });
    expect(await p.load("/@keel/entry.ts")).toBe(resumeEntry(undefined, "production", "virtual:keel.css"));
  });

  it("writes no index.html for a static deployable, in a build or in dev", async () => {
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    for (const command of ["build", "serve"] as const) {
      const root = project(STATIC);
      const p = keel();
      p.configResolved({ root, command });
      expect(p.resolveId(path.join(root, "index.html"))).toBeNull();
      expect(await p.load(path.join(root, "index.html"))).toBeNull();
    }
  });

  it("builds the client entry into dist/<name>/ and the build entry outside dist/, exporting render, not start", async () => {
    process.env.KEEL_DEPLOYABLE = "web";
    const root = project(`{ api: { modules: ["a"], adapter: "node" }, web: { modules: ["app"], adapter: "static" } }`);
    const p = keel();
    const c = JSON.stringify(p.config({ root }, { command: "build" }));
    expect(c).toContain('"build":{"outDir":"dist/web"');
    expect(c).toContain('"outDir":"node_modules/.keel/prerender/web"');
    p.configResolved({ root, command: "build" });
    const code = String(await p.load("\0virtual:keel/server"));
    expect(code).toContain("export const render = (dir, std) => prerender(");
    expect(code).toContain('deployable: "web"');
    expect(code).not.toContain("start(");
    expect(code).not.toContain("KEEL_APP_DIR");
  });
});

describe("noDeployable", () => {
  it("names the deployables KEEL_DEPLOYABLE may take, or the deployable to add", async () => {
    expect(
      noDeployable("/e.ts", { a: { modules: [], adapter: "node" }, b: { modules: [], adapter: "client" } }, "x"),
    ).toBe("keel: /e.ts serves no deployable x; set KEEL_DEPLOYABLE to one of a, b");
    const add =
      "keel: /e.ts needs a deployable; add a client or static one to topology.ts, or set KEEL_DEPLOYABLE to one";
    expect(noDeployable("/e.ts", undefined, "x")).toBe(add);
    expect(noDeployable("/e.ts", {}, undefined)).toBe(add);
    const p = keel();
    p.configResolved({ root: project(undefined), command: "build" });
    await expect(p.load("/@keel/entry.ts")).rejects.toThrow(add.replace("/e.ts", "/@keel/entry.ts"));
  });
});
