// k.scaffold Refresh: in a project that holds `.keel/` artifacts, an applied operation runs `keel build`'s steps up to
// the bundles over the tree after it (`Io.refresh`, never `Io.build`), so the artifacts it makes stale (`surface.json`
// for a changed contract) are rewritten and `keel check` stays clean; a dry run, and a project never built, refresh nothing.
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { buildCommand } from "../src/internal/buildCommand.ts";
import { runEngine } from "../src/internal/runEngine.ts";
import { linkedProject } from "./support/linkedProject.ts";

/**
 * A stand-in for an example project of the repository, so the scaffolded sources resolve its installed `@keel/*`
 * packages while the type cache of each check stays out of the example.
 */
const PROJECT = linkedProject(fileURLToPath(new URL("../../../examples/client-only-api", import.meta.url)));
const CWD = PROJECT.root;
afterAll(PROJECT.remove);
type Files = { path: string; source: string }[];
const applied = (files: Files, writes: readonly { path: string; content: string | null }[]): Files => {
  const m = new Map(files.map((f) => [f.path, f.source]));
  for (const w of writes)
    if (w.content === null) m.delete(w.path);
    else m.set(w.path, w.content);
  return [...m].map(([path, source]) => ({ path, source }));
};
const e1005 = async (files: Files): Promise<string[]> =>
  (await run(["check", "--format=json"], { cwd: CWD, files })).stdout.split("\n").filter((l) => l.includes('"E1005"'));

/** A fresh `scaffold project shop`, then the `.keel/` artifacts `keel build` writes with no disk half. */
async function builtProject(): Promise<Files> {
  const made = await runEngine(["scaffold", "project", "shop"], { cwd: CWD, files: [] });
  const files = applied(
    [],
    made.writes.map((w) => ({ ...w, path: w.path.replace(/^shop\//, "") })),
  );
  const built = await buildCommand({ cwd: CWD, files });
  return applied(files, built.writes);
}

describe("scaffold refreshes the artifacts it makes stale", () => {
  it("scaffold route in a built project refreshes over the tree after its edit set, applied first, with no bundle", async () => {
    const files = await builtProject();
    expect(files.some((f) => f.path === ".keel/ids.json")).toBe(true);
    expect(await e1005(files)).toEqual([]);
    const steps: string[] = [];
    const e = await runEngine(["scaffold", "route", "app.releases", "--path", "/releases"], {
      cwd: CWD,
      files,
      apply: (w) => steps.push(`apply ${w.map((x) => x.path).join(" ")}`),
      build: async () => {
        steps.push("bundle");
        return { code: 0, diagnostics: [], stderr: "" };
      },
      refresh: async (cwd) => {
        steps.push(`build ${cwd === CWD}`);
        return { code: 0, diagnostics: [], stderr: "" };
      },
    });
    expect(e.result.code).toBe(0);
    expect(
      e.result.stdout
        .split("\n")
        .filter((l) => l !== "")
        .at(-1),
    ).toMatch(/^ok scaffold route 3 created, 2 changed, 0 removed, [1-9]\d* artifacts, 0 errors$/);
    expect(steps).not.toContain("bundle");
    // The edit set reaches the host, then the build's static artifacts, then the disk half reads both.
    expect(steps[0]).toContain("modules/app/app.contract.ts");
    expect(steps[1]).toContain(".keel/ids.json");
    expect(steps[2]).toBe("build true");
    expect(steps.filter((s) => s.startsWith("build"))).toHaveLength(1);
    expect(await e1005(applied(files, e.writes))).toEqual([]);
  });

  it("a failing disk half fails the scaffold with its diagnostics and exit code", async () => {
    const files = await builtProject();
    const e = await runEngine(["scaffold", "route", "app.releases", "--path", "/releases"], {
      cwd: CWD,
      files,
      refresh: async () => ({
        code: 1,
        diagnostics: [{ kind: "diag", code: "E1006", path: "modules/app/routes.ts", line: 1, col: 1, message: "x" }],
        stderr: "",
      }),
    });
    expect(e.result.code).toBe(1);
    expect(e.result.stdout).toContain("E1006");
    expect(
      e.result.stdout
        .split("\n")
        .filter((l) => l !== "")
        .at(-1),
    ).toMatch(/^fail scaffold route /);
  });

  it("a dry run and a project with no artifacts write no .keel/ file", async () => {
    const files = await builtProject();
    let builds = 0;
    const build = async () => {
      builds += 1;
      return { code: 0, diagnostics: [], stderr: "" };
    };
    const dry = await runEngine(["scaffold", "route", "app.releases", "--path", "/releases", "--dry-run"], {
      cwd: CWD,
      files,
      build,
      refresh: build,
    });
    expect(dry.writes).toEqual([]);
    const bare = files.filter((f) => !f.path.startsWith(".keel/"));
    const e = await runEngine(["scaffold", "route", "app.releases", "--path", "/releases"], {
      cwd: CWD,
      files: bare,
      build,
      refresh: build,
    });
    expect(e.result.code).toBe(0);
    expect(e.writes.some((w) => w.path.startsWith(".keel/"))).toBe(false);
    expect(builds).toBe(0);
  });
});
