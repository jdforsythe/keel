// `keel build` of a `static` deployable (k.topology Declaration, k.security Other deployables): the project's own build
// of a topology with no `client` or `node` deployable serves the first `static` one's resume entry, writes a default
// `index.html` when the project has none, and a build error with no deployable to serve names the fix.
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

describe("the own build of a static-only topology", () => {
  it("serves the static deployable's resume entry, with no KEEL_DEPLOYABLE", async () => {
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    const p = keel();
    p.configResolved({ root: project(STATIC), command: "build" });
    expect(await p.load("/@keel/entry.ts")).toBe(resumeEntry(undefined, "production", "virtual:keel.css"));
  });

  it("writes a default index.html scripting the entry when the project has none, and keeps one it has", async () => {
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    const root = project(STATIC);
    const p = keel();
    p.configResolved({ root, command: "build" });
    const index = path.join(root, "index.html");
    expect(p.resolveId(index)).toBe(index);
    expect(await p.load(index)).toBe(indexHtml("web", "/@keel/entry.ts"));
    fs.writeFileSync(index, "<p>own</p>");
    expect(p.resolveId(index)).toBeNull();
    expect(await p.load(index)).toBeNull();
  });

  it("writes no index.html in dev, or when a node deployable is the one served", async () => {
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    const dev = project(STATIC);
    const p = keel();
    p.configResolved({ root: dev, command: "serve" });
    expect(p.resolveId(path.join(dev, "index.html"))).toBeNull();
    const mixed = project(`{ api: { modules: ["a"], adapter: "node" }, web: { modules: ["app"], adapter: "static" } }`);
    const q = keel();
    q.configResolved({ root: mixed, command: "build" });
    expect(q.resolveId(path.join(mixed, "index.html"))).toBeNull();
  });

  it("serves the static deployable KEEL_DEPLOYABLE names, with its index.html", async () => {
    process.env.KEEL_DEPLOYABLE = "web";
    const root = project(`{ api: { modules: ["a"], adapter: "node" }, web: { modules: ["app"], adapter: "static" } }`);
    const p = keel();
    p.configResolved({ root, command: "build" });
    expect(await p.load(path.join(root, "index.html"))).toBe(indexHtml("web", "/@keel/entry.ts"));
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
