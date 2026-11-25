// Spec: k.scaffold, Links "Before its first write, an operation's edit set (E1357; `keel docs --sync` too, k.docs) is judged against the real path of the project root, and a shell's files (E1585, k.shell Files) against that real path joined with `deploy/<name>/<shell>/`, so a link among those folders refuses them. A target refuses the whole set when it is a symbolic link, an existing file with more than one hard link, or a path whose nearest existing ancestor's real path, joined with the rest of the path, is outside the root; an ancestor that cannot be read counts as outside. Paths are compared by segment, so `proj-evil` beside `proj` is outside it; a link that resolves back inside is followed. The judgement is made once: a link made between it and the write is followed."
// Spec: k.scaffold, Rules "E1357 a write a link carries out of the project (Links)"
// Spec: k.scaffold, Conformance "`keel docs --sync` in a project whose `AGENTS.md` is a hard link to a file outside it, and in one whose `.claude` is a symbolic link to a folder `proj-evil/.claude` beside the project `proj`, is each one E1357 and writes nothing; with `.claude` a symbolic link to a folder inside the project, it writes through it."
// Spec: k.shell, Files "`files` gives the shell files, read-only deploy files (k.deploy; E1005, fix: the regenerated file); a path with a `..` segment, a `\\` or a leading `/`, or one a link carries out of the folder (k.scaffold Links), is E1585: none of the set is written. Another file there is the app's. Removing a shell removes its files." (E1585, judged by the same Links rule; its cases are in shell-target-symlink.test.ts)
// Seed: none (examples over a closed set of link shapes; real temporary directories, real links, the real `keel` binary).
// The project is `<tmp>/proj`, its sibling `<tmp>/proj-evil` is outside it; a refused set leaves both trees, and every file the links point at, byte for byte as they were.
// Reading: "is each one E1357" is read as one E1357 diagnostic for the operation, exit 1; the other shapes assert at least one, since the spec does not say how many refused targets are reported.
// Reading: a target that is a symbolic link, or an existing file with a link count above 1, is refused whether or not the link leads back inside the project; only a folder link that resolves back inside is followed.
// Reading: a dangling link on the way to a write counts as a path whose ancestor cannot be read, so it is outside.
import {
  chmodSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { cleanup, diags, keel, materialize } from "./compat-support";
import { SLOW, buildCalls, cleanup as cleanupStub, run as runStub, stubProject, withCode } from "./shell-stub.ts";

const PKG = `${JSON.stringify({ name: "app", version: "0.0.0", dependencies: { "@keel/cli": "*" } })}\n`;
const made: string[] = [];
const unlock: string[] = [];
afterAll(() => {
  for (const p of unlock) chmodSync(p, 0o755);
  for (const d of made) cleanup(d);
});

/** `<tmp>/proj` holding a `package.json`, and an empty `<tmp>/proj-evil` beside it. */
function layout(): { parent: string; proj: string; evil: string } {
  const parent = mkdtempSync(join(realpathSync(tmpdir()), "keel-links-"));
  made.push(parent);
  const built = materialize({ "package.json": PKG });
  const proj = join(parent, "proj");
  renameSync(built, proj);
  const evil = join(parent, "proj-evil");
  mkdirSync(evil);
  return { parent, proj, evil };
}

/** Every path under `dir` (but `node_modules`) with its bytes, or what a link points at. */
function tree(dir: string, rel = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(join(dir, rel)).sort()) {
    if (rel === "" && name === "node_modules") continue;
    const p = rel === "" ? name : `${rel}/${name}`;
    const st = lstatSync(join(dir, p));
    if (st.isSymbolicLink()) out[p] = `link:${readlinkSync(join(dir, p))}`;
    else if (st.isDirectory()) {
      out[p] = "dir";
      Object.assign(out, tree(dir, p));
    } else out[p] = `file:${st.nlink}:${readFileSync(join(dir, p), "utf8")}`;
  }
  return out;
}

const sync = (proj: string) => keel(proj, ["docs", "--sync"]);

describe("k.scaffold Links: `keel docs --sync` judges its edit set against the real path of the project root", () => {
  test("`keel docs --sync` in a project whose `AGENTS.md` is a hard link to a file outside it is one E1357 and writes nothing", () => {
    const { proj, evil } = layout();
    writeFileSync(join(evil, "agents.md"), "outside bytes\n");
    linkSync(join(evil, "agents.md"), join(proj, "AGENTS.md"));
    const before = { proj: tree(proj), evil: tree(evil) };
    const r = sync(proj);
    expect(r.status).toBe(1);
    expect(diags(r, "E1357")).toHaveLength(1);
    expect(readFileSync(join(evil, "agents.md"), "utf8")).toBe("outside bytes\n");
    expect({ proj: tree(proj), evil: tree(evil) }).toEqual(before);
  });

  test("`keel docs --sync` in a project whose `.claude` is a symbolic link to a folder `proj-evil/.claude` beside the project `proj` is one E1357 and writes nothing", () => {
    const { proj, evil } = layout();
    mkdirSync(join(evil, ".claude"));
    writeFileSync(join(evil, ".claude", "keep.txt"), "mine\n");
    symlinkSync(join(evil, ".claude"), join(proj, ".claude"));
    const before = { proj: tree(proj), evil: tree(evil) };
    const r = sync(proj);
    expect(r.status).toBe(1);
    expect(diags(r, "E1357")).toHaveLength(1);
    expect({ proj: tree(proj), evil: tree(evil) }).toEqual(before);
  });

  test("with `.claude` a symbolic link to a folder inside the project, `keel docs --sync` writes through it", () => {
    const { proj } = layout();
    mkdirSync(join(proj, "agent-home"));
    symlinkSync(join(proj, "agent-home"), join(proj, ".claude"));
    const r = sync(proj);
    expect(r.status).toBe(0);
    expect(diags(r, "E1357")).toEqual([]);
    expect(readdirSync(join(proj, "agent-home"), { recursive: true }).length).toBeGreaterThan(0);
    expect(readdirSync(proj)).toContain("AGENTS.md");
  });

  test("a project root reached through a link (as `/tmp` is on macOS) is judged by its real path: a link to a folder inside it is followed, one beside it refused", () => {
    const { parent, proj, evil } = layout();
    const via = join(parent, "via");
    symlinkSync(proj, via);
    mkdirSync(join(proj, "agent-home"));
    symlinkSync(join(proj, "agent-home"), join(proj, ".claude"));
    const ok = sync(via);
    expect(ok.status).toBe(0);
    expect(diags(ok, "E1357")).toEqual([]);
    rmSync(join(proj, ".claude"));
    symlinkSync(evil, join(proj, ".claude"));
    const refused = sync(via);
    expect(refused.status).toBe(1);
    expect(diags(refused, "E1357").length).toBeGreaterThan(0);
    expect(readdirSync(evil)).toEqual([]);
  });

  test("a link that leads back inside through a chain of links is followed", () => {
    const { proj } = layout();
    mkdirSync(join(proj, "agent-home"));
    symlinkSync(join(proj, "agent-home"), join(proj, "hop"));
    symlinkSync(join(proj, "hop"), join(proj, ".claude"));
    const r = sync(proj);
    expect(r.status).toBe(0);
    expect(diags(r, "E1357")).toEqual([]);
  });

  const shapes: [string, (proj: string, evil: string) => void][] = [
    [
      "`AGENTS.md` a symbolic link to a file outside",
      (proj, evil) => {
        writeFileSync(join(evil, "a.md"), "outside\n");
        symlinkSync(join(evil, "a.md"), join(proj, "AGENTS.md"));
      },
    ],
    [
      "`AGENTS.md` and another file inside the project hard links of one file (a link count above 1)",
      (proj) => {
        writeFileSync(join(proj, "twin.md"), "twin\n");
        linkSync(join(proj, "twin.md"), join(proj, "AGENTS.md"));
      },
    ],
    [
      ".claude a link to `../proj-evil/.claude` (a relative link to a sibling that has the root as a prefix)",
      (proj, evil) => {
        mkdirSync(join(evil, ".claude"));
        symlinkSync("../proj-evil/.claude", join(proj, ".claude"));
      },
    ],
    [
      ".claude a link to the folder holding the project (an ancestor of the root)",
      (proj) => {
        symlinkSync("..", join(proj, ".claude"));
      },
    ],
    [
      ".claude a link to `hop`, itself a link to a folder outside (a chain)",
      (proj, evil) => {
        mkdirSync(join(evil, "real"));
        symlinkSync(join(evil, "real"), join(proj, "hop"));
        symlinkSync(join(proj, "hop"), join(proj, ".claude"));
      },
    ],
    [
      ".claude/skills a dangling link to a path outside (a dangling intermediate folder)",
      (proj) => {
        mkdirSync(join(proj, ".claude"));
        symlinkSync("../../proj-evil/missing", join(proj, ".claude", "skills"));
      },
    ],
    [
      ".claude a link to `../proj-evil/.claude` that does not exist (dangling)",
      (proj) => {
        symlinkSync("../proj-evil/.claude", join(proj, ".claude"));
      },
    ],
  ];
  for (const [name, setup] of shapes) {
    test(`with ${name}, \`keel docs --sync\` is E1357, exit 1, and writes nothing`, () => {
      const { proj, evil } = layout();
      setup(proj, evil);
      const before = { proj: tree(proj), evil: tree(evil) };
      const r = sync(proj);
      expect(r.status).toBe(1);
      expect(diags(r, "E1357").length).toBeGreaterThan(0);
      expect({ proj: tree(proj), evil: tree(evil) }).toEqual(before);
    });
  }

  test("an ancestor that cannot be read counts as outside: a `.claude` folder with no permissions is E1357 and nothing is written", () => {
    if (process.getuid?.() === 0) return; // a superuser reads any folder; the clause has no case there
    const { proj } = layout();
    mkdirSync(join(proj, ".claude"));
    chmodSync(join(proj, ".claude"), 0o000);
    unlock.push(join(proj, ".claude"));
    const r = sync(proj);
    chmodSync(join(proj, ".claude"), 0o755);
    expect(r.status).toBe(1);
    expect(diags(r, "E1357").length).toBeGreaterThan(0);
    expect(readdirSync(proj)).not.toContain("AGENTS.md");
  });

  test("a project whose files each have one link and no link on the way is synced: exit 0, no E1357 (the control for the cases above)", () => {
    const { proj } = layout();
    const r = sync(proj);
    expect(r.status).toBe(0);
    expect(diags(r, "E1357")).toEqual([]);
    expect(readdirSync(proj)).toContain("AGENTS.md");
  });
});

describe("k.scaffold Links: an operation's edit set is judged once, before its first write, as a whole", () => {
  function scaffolded() {
    const l = layout();
    rmSync(join(l.proj, "package.json"));
    const made_ = keel(l.parent, ["scaffold", "project", "shop"]);
    expect(made_.status).toBe(0);
    return { ...l, shop: join(l.parent, "shop") };
  }

  test("`keel scaffold module orders` where `modules/orders` is a link to a sibling folder that has the project as a prefix is E1357, and nothing is written", () => {
    const { parent, shop } = scaffolded();
    const evil = join(parent, "shop-evil");
    mkdirSync(evil);
    symlinkSync(evil, join(shop, "modules", "orders"));
    const before = { shop: tree(shop), evil: tree(evil) };
    const r = keel(shop, ["scaffold", "module", "orders"]);
    expect(r.status).toBe(1);
    expect(diags(r, "E1357").length).toBeGreaterThan(0);
    expect({ shop: tree(shop), evil: tree(evil) }).toEqual(before);
  });

  test("`keel scaffold module orders` where `topology.ts` is a hard link to a file outside is E1357: the outside file is unchanged and no module folder is created", () => {
    const { parent, shop } = scaffolded();
    const outside = join(parent, "outside-topology.ts");
    const bytes = readFileSync(join(shop, "topology.ts"), "utf8");
    writeFileSync(outside, bytes);
    rmSync(join(shop, "topology.ts"));
    linkSync(outside, join(shop, "topology.ts"));
    const before = tree(shop);
    const r = keel(shop, ["scaffold", "module", "orders"]);
    expect(r.status).toBe(1);
    expect(diags(r, "E1357").length).toBeGreaterThan(0);
    expect(readFileSync(outside, "utf8")).toBe(bytes);
    expect(tree(shop)).toEqual(before);
  });
});

describe("k.scaffold Links: a shell's files (E1585) are judged against the real path joined with `deploy/<name>/<shell>/`", () => {
  test(
    "`deploy/web/tauri/a.json` an existing file with more than one hard link to a file outside the project: `keel check` reports one E1585 and `keel build` writes nothing under `deploy/web/tauri/` or to the other name",
    () => {
      const dir = stubProject();
      const outer = mkdtempSync(join(realpathSync(tmpdir()), "keel-hard-"));
      try {
        const other = join(outer, "other.json");
        writeFileSync(other, "outside\n");
        mkdirSync(join(dir, "deploy/web/tauri"), { recursive: true });
        linkSync(other, join(dir, "deploy/web/tauri/a.json"));
        expect(withCode(runStub(dir, ["check"]), "E1585")).toHaveLength(1);
        runStub(dir, ["build", "--target", "tauri"]);
        expect(readFileSync(other, "utf8")).toBe("outside\n");
        expect(readdirSync(join(dir, "deploy/web/tauri"))).toEqual(["a.json"]);
        expect(readFileSync(join(dir, "deploy/web/tauri/a.json"), "utf8")).toBe("outside\n");
        expect(buildCalls(dir)).toEqual([]);
      } finally {
        cleanupStub(dir);
        rmSync(outer, { recursive: true, force: true });
      }
    },
    SLOW,
  );
});
