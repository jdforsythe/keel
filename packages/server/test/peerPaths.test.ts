// peerPaths (k.topology Calls and peers): the paths the named peers serve, read from `<artifacts>/routes.json`. Each
// case writes its own artifacts folder and loads a fresh copy of the module.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Topology } from "@keel/compiler";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TOPOLOGY: Topology = {
  web: { modules: ["shell", "home"], adapter: "node" },
  api: { modules: ["orders", "billing"], adapter: "node" },
  files: { modules: ["blobs"], adapter: "node" },
};

let root = "";
let n = 0;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-peerpaths-"));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** An artifacts folder whose `routes.json` holds `text`, or no such file when `text` is undefined. */
function artifactsWith(text: string | undefined): string {
  const dir = path.join(root, `a${n++}`);
  fs.mkdirSync(dir);
  if (text !== undefined) fs.writeFileSync(path.join(dir, "routes.json"), text);
  return dir;
}
const routes = (data: unknown): string => JSON.stringify({ data });

async function peerPaths(artifacts: string | undefined, peers: readonly string[], topology: Topology = TOPOLOGY) {
  vi.resetModules();
  const mod = await import("../src/internal/peerPaths.ts");
  return mod.peerPaths(artifacts, topology, peers);
}

describe("peerPaths", () => {
  it("lists each route whose module is in a named peer, with its path split into segments", async () => {
    const dir = artifactsWith(
      routes({
        a: { module: "orders", path: "/orders/:id" },
        b: { module: "billing", path: "/billing" },
        c: { module: "home", path: "/" },
        d: { module: "blobs", path: "/files/:name" },
      }),
    );
    expect(await peerPaths(dir, ["api"])).toEqual([
      { segments: ["orders", ":id"], deployable: "api" },
      { segments: ["billing"], deployable: "api" },
    ]);
    expect(await peerPaths(dir, ["api", "files"])).toEqual([
      { segments: ["orders", ":id"], deployable: "api" },
      { segments: ["billing"], deployable: "api" },
      { segments: ["files", ":name"], deployable: "files" },
    ]);
  });

  it("drops empty segments: doubled, leading and trailing slashes, and the root path", async () => {
    const dir = artifactsWith(
      routes({
        a: { module: "orders", path: "//a///b//" },
        b: { module: "orders", path: "/" },
        c: { module: "orders", path: "" },
      }),
    );
    expect(await peerPaths(dir, ["api"])).toEqual([
      { segments: ["a", "b"], deployable: "api" },
      { segments: [], deployable: "api" },
      { segments: [], deployable: "api" },
    ]);
  });

  it("names the first peer, in the order given, whose modules hold the route's module", async () => {
    const topology: Topology = {
      one: { modules: ["shared"], adapter: "node" },
      two: { modules: ["shared"], adapter: "node" },
    };
    const dir = artifactsWith(routes({ a: { module: "shared", path: "/s" } }));
    expect(await peerPaths(dir, ["two", "one"], topology)).toEqual([{ segments: ["s"], deployable: "two" }]);
    expect(await peerPaths(dir, ["one", "two"], topology)).toEqual([{ segments: ["s"], deployable: "one" }]);
  });

  it("skips a peer the topology does not define and keeps looking", async () => {
    const dir = artifactsWith(routes({ a: { module: "orders", path: "/o" } }));
    expect(await peerPaths(dir, ["ghost", "api"])).toEqual([{ segments: ["o"], deployable: "api" }]);
    expect(await peerPaths(dir, ["ghost"])).toEqual([]);
  });

  it("gives none without artifacts or without peers, and reads no file for them", async () => {
    const dir = artifactsWith(routes({ a: { module: "orders", path: "/o" } }));
    expect(await peerPaths(undefined, ["api"])).toEqual([]);
    expect(await peerPaths(dir, [])).toEqual([]);
  });

  it("gives none for a missing file, a folder named routes.json, an empty file or invalid JSON", async () => {
    expect(await peerPaths(artifactsWith(undefined), ["api"])).toEqual([]);
    const folder = artifactsWith(undefined);
    fs.mkdirSync(path.join(folder, "routes.json"));
    expect(await peerPaths(folder, ["api"])).toEqual([]);
    expect(await peerPaths(artifactsWith(""), ["api"])).toEqual([]);
    expect(await peerPaths(artifactsWith("{ not json"), ["api"])).toEqual([]);
  });

  it("gives none when the document or its data is not an object", async () => {
    for (const text of [
      "null",
      "7",
      '"x"',
      "true",
      "[]",
      "{}",
      '{"data":null}',
      '{"data":7}',
      '{"data":"x"}',
      '{"data":true}',
    ]) {
      expect(await peerPaths(artifactsWith(text), ["api"]), text).toEqual([]);
    }
  });

  it("skips an entry that is not an object, and one whose module or path is not a string", async () => {
    const dir = artifactsWith(
      routes({
        a: null,
        b: 7,
        c: "orders",
        d: { path: "/nomodule" },
        e: { module: 7, path: "/numeric-module" },
        f: { module: "orders" },
        g: { module: "orders", path: 7 },
        h: { module: "unknown", path: "/unknown" },
        i: { module: "orders", path: "/kept" },
      }),
    );
    expect(await peerPaths(dir, ["api"])).toEqual([{ segments: ["kept"], deployable: "api" }]);
  });

  it("does not match a module by a prefix or a different case", async () => {
    const dir = artifactsWith(
      routes({
        a: { module: "order", path: "/a" },
        b: { module: "Orders", path: "/b" },
        c: { module: "orders2", path: "/c" },
      }),
    );
    expect(await peerPaths(dir, ["api"])).toEqual([]);
  });
});
