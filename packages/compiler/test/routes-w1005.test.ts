// rfc:0055 (backlog 0139): `artifactHashes` marks routes.json beside a manifest as `null` (not derivable without
// evaluation), and the Vite plugin's build warns W1005 before it rewrites a differing routes.json.
import fs from "node:fs";
import path from "node:path";
import { artifactHashes, compile, stdArtifact } from "@keel/compiler";
import keel from "@keel/compiler/vite";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalJson } from "../src/internal/canonicalJson.ts";
import { hashOf } from "../src/internal/hashOf.ts";

const C = { path: "src/C.tsx", source: 'export default function C() {\n  return <p id="c.p">x</p>\n}\n' };
const WARNING = "keel: W1005 .keel/routes.json differed from routes.ts; rewritten";

describe("artifactHashes", () => {
  it("is the compiler's hashes, with routes.json null only beside a modules/<m>/routes.ts", () => {
    const { hashes } = compile([C]);
    expect(artifactHashes([C])).toEqual({ ...hashes, "std.json": stdArtifact([]).hash });
    const manifest = { path: "modules/m/routes.ts", source: "export const routes = {}\n" };
    expect(artifactHashes([C, manifest])).toEqual({
      ...compile([C, manifest]).hashes,
      "routes.json": null,
      "std.json": stdArtifact([]).hash,
    });
    for (const p of ["routes.ts", "modules/routes.ts", "modules/m/sub/routes.ts", "x/modules/m/routes.ts"])
      expect(artifactHashes([C, { path: p, source: "export const routes = {}\n" }])["routes.json"]).toBeTypeOf(
        "string",
      );
  });
});

describe("vite plugin build: a differing routes.json", () => {
  let root = "";
  const file = (): string => path.join(root, ".keel", "routes.json");
  const genuine = `${canonicalJson({ data: {}, hash: hashOf({}) })}\n`;
  const prior = (text: string): void => {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), text);
  };
  const build = async (command: "build" | "serve"): Promise<string[]> => {
    const warnings: string[] = [];
    const p = keel();
    p.configResolved({ root, command });
    await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
    return warnings;
  };
  beforeEach(() => {
    root = tempDir(".tmp-w1005-", import.meta.dirname);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("warns W1005 once at build and rewrites it", { timeout: fixedTime(30000) }, async () => {
    const data = { r: { path: "/forged" } };
    prior(`${canonicalJson({ data, hash: hashOf(data) })}\n`);
    expect(await build("build")).toEqual([WARNING]);
    expect(fs.readFileSync(file(), "utf8")).toBe(genuine);
  });

  it(
    "is silent when routes.json is absent, genuine, or the server is not building",
    { timeout: fixedTime(30000) },
    async () => {
      expect(await build("build")).toEqual([]);
      expect(fs.readFileSync(file(), "utf8")).toBe(genuine);
      expect(await build("build")).toEqual([]);
      fs.chmodSync(file(), 0o644);
      prior("forged\n");
      expect(await build("serve")).toEqual([]);
      expect(fs.readFileSync(file(), "utf8")).toBe(genuine);
    },
  );
});
