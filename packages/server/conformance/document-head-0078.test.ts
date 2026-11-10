// Spec: k.head, clause "A built document has the head this section names; an unmatched path is 404 with an `h1`." (rfc:0078, rfc:0079)
// Seed: 1337. Generated inputs: deployable names drawn from [a-z][a-z0-9-]{0,15}. The dist fixture is hand-built in a realpath'd tmp dir; `keel build` is not run.
// @vitest-environment happy-dom
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Fetcher = { fetch(req: Request): Promise<Response> };

const MANIFEST_TEXT = JSON.stringify({
  "entry.ts": {
    file: "assets/entry-B1x2Y3z4.js",
    isEntry: true,
    css: ["assets/entry-Ab12Cd34.css"],
  },
});
const SVG_BYTES = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>\n");
const roots: string[] = [];
let dist = "";

function write(file: string, content: string | Uint8Array): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function tmp(prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  roots.push(dir);
  return dir;
}

async function appFor(name: string, assets?: string): Promise<Fetcher> {
  return createApp({
    topology: topology({ [name]: { modules: ["app"], adapter: "node" } }),
    routes: manifest({ "app.home": { path: "/", component: () => document.createElement("p") } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    ...(assets === undefined ? { mode: "dev" as const } : { mode: "production" as const, assets }),
  });
}

const get = (app: Fetcher, url: string): Promise<Response> => app.fetch(new Request(`http://localhost${url}`));

type Parsed = { head: DocumentFragment; body: DocumentFragment };

// Inert parse: template content never loads stylesheets, so head and body are split at </head>.
function parse(text: string): Parsed {
  const at = text.indexOf("</head>");
  const part = (html: string): DocumentFragment => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return t.content;
  };
  return at < 0 ? { head: part(text), body: part("") } : { head: part(text.slice(0, at)), body: part(text.slice(at)) };
}

function expectBuiltHead(doc: Parsed, name: string): void {
  expect(doc.head.querySelector("title")?.textContent).toBe(name);
  const sheets = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]'));
  expect(sheets.map((l) => l.getAttribute("href"))).toContain("/assets/entry-Ab12Cd34.css");
  const icons = Array.from(doc.head.querySelectorAll('link[rel="icon"]'));
  expect(icons.map((l) => l.getAttribute("href"))).toContain("/keel-mark.svg");
}

beforeAll(() => {
  const root = tmp("keel-document-head-");
  dist = path.join(root, "dist", "web");
  write(path.join(dist, ".vite", "manifest.json"), MANIFEST_TEXT);
  write(path.join(dist, "assets", "entry-B1x2Y3z4.js"), "export const resume = 1;\n");
  write(path.join(dist, "assets", "entry-Ab12Cd34.css"), "body{margin:0}\n");
  write(path.join(dist, "keel-mark.svg"), SVG_BYTES);
});

afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

describe("k.head: a built document has the head this section names; an unmatched path is 404 with an h1", () => {
  it("a built document has the head this section names: title the deployable name, entry CSS, and the keel-mark icon", async () => {
    const app = await appFor("web", dist);
    const res = await get(app, "/");
    expect(res.status).toBe(200);
    expectBuiltHead(parse(await res.text()), "web");
  });

  it("the built icon /keel-mark.svg is served as image/svg+xml, nosniff, with the file's bytes; the build manifest is not served", async () => {
    const app = await appFor("web", dist);
    const res = await get(app, "/keel-mark.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("image/svg+xml");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(SVG_BYTES);
    const hidden = await get(app, "/.vite/manifest.json");
    expect(hidden.status).not.toBe(200);
  });

  it("an unmatched path is 404 with the same head and an h1 in the body", async () => {
    const app = await appFor("web", dist);
    const res = await get(app, "/no/such/page");
    expect(res.status).toBe(404);
    const doc = parse(await res.text());
    expectBuiltHead(doc, "web");
    expect(doc.body.querySelector("h1")).not.toBeNull();
  });

  it("property: for any deployable name the document title text equals the name", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/), async (name) => {
        const app = await appFor(name, dist);
        const res = await get(app, "/");
        expect(res.status).toBe(200);
        expect(parse(await res.text()).head.querySelector("title")?.textContent).toBe(name);
      }),
      { seed: 1337, numRuns: 25 },
    );
  });

  it("the raw title element content holds no unescaped less-than sign", async () => {
    const app = await appFor("web", dist);
    const raw = await (await get(app, "/")).text();
    const m = /<title>([\s\S]*?)<\/title>/.exec(raw);
    expect(m).not.toBeNull();
    expect(m?.[1] ?? "<").not.toContain("<");
  });

  it("without assets (dev mode) the document still has the title and no stylesheet or icon link", async () => {
    const app = await appFor("web");
    const res = await get(app, "/");
    expect(res.status).toBe(200);
    const doc = parse(await res.text());
    expect(doc.head.querySelector("title")?.textContent).toBe("web");
    expect(doc.head.querySelector('link[rel="stylesheet"]')).toBeNull();
    expect(doc.head.querySelector('link[rel="icon"]')).toBeNull();
  });
});
