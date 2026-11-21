// Spec: k.docs "A package's `docs/`, `docs/*.json`, `docs/<id>.md` or `skills/<name>/SKILL.md` whose real path leaves the package's real folder, or over 1,000,000 bytes, is absent and never read."
// Spec: k.docs Rules E1066 "... the message names the package and its version." (RFC 0151 Conformance diff, symlink bullets.)
// Seed: none (examples; real temp directories, real symlinks, the real `keel` binary).
// Untestable here: a `skills/<name>/SKILL.md` link, since the skills come from the running `@keel/cli`, which is the repo's own.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, keel, materialize } from "./compat-support";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const SECRET = "OUTSIDE-SECRET-TEXT-zz";
const pkgJson = `${JSON.stringify({ name: "app", version: "0.0.0", dependencies: { "@keel/evil": "*" } })}\n`;
const evilJson = `${JSON.stringify({ name: "@keel/evil", version: "9.9.9" })}\n`;
const index = `${JSON.stringify({ sections: [{ id: "zz", title: "Zz", codes: [] }] })}\n`;
const text = (r: { records: { [k: string]: unknown }[] }): string => JSON.stringify(r.records);

function setup(): { d: string; out: string; evil: string } {
  const d = materialize({ "package.json": pkgJson });
  made.push(d);
  const out = mkdtempSync(join(tmpdir(), "keel-outside-"));
  made.push(out);
  const evil = join(d, "node_modules/@keel/evil");
  mkdirSync(evil, { recursive: true });
  writeFileSync(join(evil, "package.json"), evilJson);
  return { d, out, evil };
}

describe("k.docs symlinks", () => {
  it("a package whose docs is a symlink to an outside folder is absent: `keel docs zz` exits non-zero without the outside text and `keel docs` lists no zz", () => {
    const { d, out, evil } = setup();
    writeFileSync(join(out, "index.json"), index);
    writeFileSync(join(out, "zz.md"), `# zz\n${SECRET}\n`);
    symlinkSync(out, join(evil, "docs"));
    const one = keel(d, ["docs", "zz"]);
    expect(one.status).not.toBe(0);
    expect(text(one)).not.toContain(SECRET);
    const all = keel(d, ["docs"]);
    expect(all.records.filter((r) => r.kind === "docs.entry" && r.id === "zz")).toEqual([]);
    expect(text(all)).not.toContain(SECRET);
  });

  it("a docs/<id>.md that is a symlink to an outside file: `keel docs zz` is E1066 naming @keel/evil, exit 1, without the outside text", () => {
    const { d, out, evil } = setup();
    mkdirSync(join(evil, "docs"));
    writeFileSync(join(evil, "docs/index.json"), index);
    writeFileSync(join(out, "secret.md"), `# zz\n${SECRET}\n`);
    symlinkSync(join(out, "secret.md"), join(evil, "docs/zz.md"));
    const r = keel(d, ["docs", "zz"]);
    expect(r.status).toBe(1);
    expect(r.records.filter((x) => x.kind === "diag" && x.code === "E1066").length).toBeGreaterThan(0);
    expect(text(r)).toContain("@keel/evil");
    expect(text(r)).not.toContain(SECRET);
  });

  it("a node_modules/@keel/<name> that is itself a symlink to a package folder outside the project prints its docs/<id>.md byte for byte, exit 0", () => {
    const { d, out, evil } = setup();
    const body = "# zz\nline two\n\ttabbed\n";
    mkdirSync(join(out, "docs"));
    writeFileSync(join(out, "package.json"), evilJson);
    writeFileSync(join(out, "docs/index.json"), index);
    writeFileSync(join(out, "docs/zz.md"), body);
    // replace the real folder with a link to the outside package folder (the pnpm store layout)
    writeFileSync(join(evil, "package.json"), evilJson);
    cleanup(evil);
    symlinkSync(out, evil);
    const r = keel(d, ["docs", "zz"]);
    expect(r.status).toBe(0);
    expect(r.records.find((x) => x.kind === "docs.section")).toMatchObject({ id: "zz", text: body });
    expect(readFileSync(join(out, "docs/zz.md"), "utf8")).toBe(body);
  });
});
