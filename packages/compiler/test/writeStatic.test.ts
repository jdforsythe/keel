// k.hosting Static: the last step of a static deployable's build (writeStatic) over a build entry written to a
// temporary folder: which documents land where, what is stripped and added, E1588 and what is removed after.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { keelMark } from "../src/internal/keelMark.ts";
import { writeStatic } from "../src/internal/writeStatic.ts";
import type { Topology } from "../src/types/Topology.ts";

let root = "";
let out = "";
let entry = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-static-"));
  out = path.join(root, "dist", "web");
  entry = path.join(root, "dist", ".web-entry", "server.mjs");
  fs.mkdirSync(path.join(out, ".vite"), { recursive: true });
  fs.writeFileSync(path.join(out, ".vite", "manifest.json"), "{}");
  fs.writeFileSync(path.join(out, "app.js"), "export {}");
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(path.join(path.dirname(entry), "chunk.mjs"), "export {}");
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const TOPOLOGY: Topology = {
  web: { modules: ["a"], adapter: "static" },
  api: { modules: ["b"], adapter: "node" },
  "my-api": { modules: ["c"], adapter: "node" },
};
const doc = (id: string | undefined, at: string, status: number, html: string) => ({ id, path: at, status, html });
const HEAD = `<html><head><meta property="csp-nonce" nonce="n1"><script nonce="n1" src="/a.js"></script></head><body><p nonce="n1">x</p></body></html>`;
const STRIPPED = (tags: string): string =>
  `<html><head><script src="/a.js"></script>${tags}</head><body><p>x</p></body></html>`;
/** Writes the build entry: `body` is the module text after `const docs = <docs>`. */
const build = (docs: unknown, body = "export const render = async () => docs"): void =>
  fs.writeFileSync(entry, `const docs = ${JSON.stringify(docs) ?? "undefined"}\n${body}\n`);
const run = (env: Record<string, string | undefined> = {}, std?: string) =>
  writeStatic(out, entry, "web", TOPOLOGY, env, std);
const text = (rel: string): string => fs.readFileSync(path.join(out, rel), "utf8");
const tree = (): string[] => {
  const walk = (dir: string, rel: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`]));
  return walk(out, "").sort();
};

describe("writeStatic", () => {
  it("writes / at index.html, a path at <path>/index.html and the not-found document at 404.html", async () => {
    build([
      doc("home", "/", 200, "<head></head>home"),
      doc("about", "/about", 200, "<head></head>about"),
      doc("deep", "/docs/a/b", 200, "<head></head>deep"),
      { id: undefined, path: "/anything", status: 404, html: "<head></head>missing" },
    ]);
    // JSON drops an undefined id: the entry restores the key.
    fs.appendFileSync(entry, "for (const d of docs) if (!('id' in d)) d.id = undefined\n");
    expect(await run()).toEqual([]);
    expect(tree()).toEqual([
      "404.html",
      "about/index.html",
      "app.js",
      "docs/a/b/index.html",
      "index.html",
      "keel-mark.svg",
    ]);
    expect(text("index.html")).toBe("<head></head>home");
    expect(text("about/index.html")).toBe("<head></head>about");
    expect(text("docs/a/b/index.html")).toBe("<head></head>deep");
    expect(text("404.html")).toBe("<head></head>missing");
  });

  it("writes the mark when the build has none, and keeps the one it has", async () => {
    build([]);
    expect(await run()).toEqual([]);
    expect(text("keel-mark.svg")).toBe(keelMark());
    fs.writeFileSync(path.join(out, "keel-mark.svg"), "<svg>own</svg>");
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    entry = path.join(path.dirname(entry), "again.mjs");
    build([]);
    expect(await run()).toEqual([]);
    expect(text("keel-mark.svg")).toBe("<svg>own</svg>");
  });

  it("strips the nonce meta and every nonce attribute, and adds a keel-peer tag per node peer set in env", async () => {
    build([doc("home", "/", 200, HEAD), doc(undefined, "/x", 404, HEAD)]);
    fs.appendFileSync(entry, "for (const d of docs) if (!('id' in d)) d.id = undefined\n");
    const env = {
      KEEL_PEER_API: "https://api.example/",
      KEEL_PEER_MY_API: "http://localhost:4100",
      KEEL_PEER_WEB: "https://web.example",
      KEEL_PEER_OTHER: "https://other.example",
    };
    expect(await run(env)).toEqual([]);
    const tags = `<meta name="keel-peer" data-deployable="api" content="https://api.example"><meta name="keel-peer" data-deployable="my-api" content="http://localhost:4100">`;
    expect(text("index.html")).toBe(STRIPPED(tags));
    expect(text("404.html")).toBe(STRIPPED(tags));
  });

  it("adds no tag when no peer is set, and only before the first </head>", async () => {
    build([doc("home", "/", 200, HEAD), doc("two", "/two", 200, "<head></head><head></head>")]);
    expect(await run({ KEEL_PEER_API: undefined })).toEqual([]);
    expect(text("index.html")).toBe(STRIPPED(""));
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    entry = path.join(path.dirname(entry), "again.mjs");
    build([doc("two", "/two", 200, "<head></head><head></head>")]);
    expect(await run({ KEEL_PEER_API: "https://api.example" })).toEqual([]);
    expect(text("two/index.html")).toBe(
      `<head><meta name="keel-peer" data-deployable="api" content="https://api.example"></head><head></head>`,
    );
  });

  it("a route answering other than 200 writes no document and is one E1588 line; the rest are written", async () => {
    build([
      doc("home", "/", 200, "<head></head>home"),
      doc("gated", "/gated", 303, "<head></head>gated"),
      doc("broken", "/broken", 500, "<head></head>broken"),
      doc("last", "/last", 200, "<head></head>last"),
    ]);
    expect(await run()).toEqual([
      "E1588 static deployable web: route gated answers 303 at build; a static page needs 200 for caller ''",
      "E1588 static deployable web: route broken answers 500 at build; a static page needs 200 for caller ''",
    ]);
    expect(tree()).toEqual(["app.js", "index.html", "keel-mark.svg", "last/index.html"]);
  });

  it("the not-found document is written whatever its status", async () => {
    build(
      [{ path: "/x", status: 404, html: "<head></head>nf" }],
      "docs[0].id = undefined\nexport const render = () => docs",
    );
    expect(await run()).toEqual([]);
    expect(text("404.html")).toBe("<head></head>nf");
  });

  it("skips what is not a document, and takes a render that is not async", async () => {
    build(
      [
        null,
        "text",
        7,
        { id: "a", path: "/a", status: 200 },
        { id: "b", path: "/b", html: "<head></head>" },
        { id: "c", status: 200, html: "<head></head>" },
        { path: "/d", status: 200, html: "<head></head>" },
        doc("ok", "/ok", 200, "<head></head>ok"),
      ],
      "export const render = () => docs",
    );
    expect(await run()).toEqual([]);
    expect(tree()).toEqual(["app.js", "keel-mark.svg", "ok/index.html"]);
  });

  it("a render that answers no list writes no document", async () => {
    build({ id: "a", path: "/", status: 200, html: "x" });
    expect(await run()).toEqual([]);
    expect(tree()).toEqual(["app.js", "keel-mark.svg"]);
  });

  it("calls render with the build folder and the std artifact", async () => {
    build(
      [],
      "export const render = (out, std) => [{ id: 'args', path: '/', status: 200, html: JSON.stringify([out, std ?? null]) }]",
    );
    expect(await run({}, "/project/.keel/std.json")).toEqual([]);
    expect(JSON.parse(text("index.html"))).toEqual([out, "/project/.keel/std.json"]);
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    entry = path.join(path.dirname(entry), "again.mjs");
    build(
      [],
      "export const render = (out, std) => [{ id: 'args', path: '/', status: 200, html: JSON.stringify([out, std ?? null]) }]",
    );
    expect(await run()).toEqual([]);
    expect(JSON.parse(text("index.html"))).toEqual([out, null]);
  });

  it("removes the manifest folder and the entry's folder when it succeeds", async () => {
    build([doc("home", "/", 200, "<head></head>")]);
    await run();
    expect(fs.existsSync(path.join(out, ".vite"))).toBe(false);
    expect(fs.existsSync(path.dirname(entry))).toBe(false);
    expect(fs.existsSync(path.dirname(path.dirname(entry)))).toBe(true);
  });

  it("an entry with no render rejects by name, and both folders are still removed", async () => {
    build([], "export const other = () => docs\nexport const render = 'not a function'");
    await expect(run()).rejects.toThrow(`keel: build entry ${entry} exports no render`);
    expect(fs.existsSync(path.join(out, ".vite"))).toBe(false);
    expect(fs.existsSync(path.dirname(entry))).toBe(false);
    expect(text("keel-mark.svg")).toBe(keelMark());
  });

  it("a Keel-coded throw of the app rejects as a keel: line; any other throw is passed on as it is", async () => {
    const cases: [string, string][] = [
      ["new Error('E1553 no storage for web')", "keel: E1553 no storage for web"],
      ["new Error('W1012 a warning')", "keel: W1012 a warning"],
      ["'E1558 thrown as text'", "keel: E1558 thrown as text"],
      ["new Error('plain failure')", "plain failure"],
      ["new Error('see E1553 no storage')", "see E1553 no storage"],
      ["new Error('E155 short')", "E155 short"],
      ["new Error('E15533 long')", "E15533 long"],
      ["new Error('X1553 other letter')", "X1553 other letter"],
      ["new Error('E1553')", "E1553"],
    ];
    for (const [i, [thrown, want]] of cases.entries()) {
      fs.mkdirSync(path.dirname(entry), { recursive: true });
      entry = path.join(path.dirname(entry), `throw-${i}.mjs`);
      build([], `export const render = async () => { throw ${thrown} }`);
      const error: unknown = await run().then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error instanceof Error ? error.message : error, thrown).toBe(want);
      expect(fs.existsSync(path.dirname(entry)), thrown).toBe(false);
    }
  });
});
