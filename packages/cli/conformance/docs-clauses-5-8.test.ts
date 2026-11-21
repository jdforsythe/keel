// Spec: k.docs "A `docs/` or `docs/<id>.md` linked outside its package is absent (E1066); a package folder linked into a store reads."
// Spec: k.docs "A skill whose `description` is `Build pages; E1401, E19xx` is listed with `title` `Build pages`."
// Seed: none (examples; real temp directories, real symlinks, the real `keel` binary; the title test uses the in-process runner).
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, keel, materialize } from "./compat-support";
import { cliPkg, jsonRecords, project } from "./docs-support";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const SECRET = "OUTSIDE-SECRET-TEXT-zz";
const pkgJson = `${JSON.stringify({ name: "app", version: "0.0.0", dependencies: { "@keel/evil": "*" } })}\n`;
const evilJson = `${JSON.stringify({ name: "@keel/evil", version: "9.9.9" })}\n`;
const index = `${JSON.stringify({ sections: [{ id: "zz", title: "Zz", codes: [] }] })}\n`;

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

describe("k.docs linked packages", () => {
  it("a `docs/` linked outside its package is absent", () => {
    const { d, out, evil } = setup();
    writeFileSync(join(out, "index.json"), index);
    writeFileSync(join(out, "zz.md"), `# zz\n${SECRET}\n`);
    symlinkSync(out, join(evil, "docs"));
    const r = keel(d, ["docs", "zz"]);
    expect(r.status).not.toBe(0);
    expect(JSON.stringify(r.records)).not.toContain(SECRET);
  });

  it("a `docs/<id>.md` linked outside its package is E1066, exit 1, never read", () => {
    const { d, out, evil } = setup();
    mkdirSync(join(evil, "docs"));
    writeFileSync(join(evil, "docs/index.json"), index);
    writeFileSync(join(out, "secret.md"), `# zz\n${SECRET}\n`);
    symlinkSync(join(out, "secret.md"), join(evil, "docs/zz.md"));
    const r = keel(d, ["docs", "zz"]);
    expect(r.status).toBe(1);
    expect(r.records.some((x) => x.kind === "diag" && x.code === "E1066")).toBe(true);
    expect(JSON.stringify(r.records)).not.toContain(SECRET);
  });

  it("a package folder linked into a store reads", () => {
    const { d, out, evil } = setup();
    const body = "# zz\nline two\n";
    mkdirSync(join(out, "docs"));
    writeFileSync(join(out, "package.json"), evilJson);
    writeFileSync(join(out, "docs/index.json"), index);
    writeFileSync(join(out, "docs/zz.md"), body);
    cleanup(evil);
    symlinkSync(out, evil);
    const r = keel(d, ["docs", "zz"]);
    expect(r.status).toBe(0);
    expect(r.records.find((x) => x.kind === "docs.section")).toMatchObject({ id: "zz", text: body });
  });
});

describe("k.docs skill titles", () => {
  it("a skill whose `description` is `Build pages; E1401, E19xx` is listed with `title` `Build pages`", async () => {
    const files = [
      ...project(["cli"]),
      ...cliPkg([], [{ name: "keel-pages", description: "Build pages; E1401, E19xx", body: "# pages\n" }]),
    ];
    const r = await jsonRecords(["docs"], files);
    expect(r.code).toBe(0);
    const e = r.recs.find((x) => x.kind === "docs.entry" && x.id === "keel-pages");
    expect(e).toMatchObject({ title: "Build pages", package: "@keel/cli", installed: true });
  });
});
