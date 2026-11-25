// `pnpm eval:public pack [--out <dir>] [--no-build]`: packs every package into a kit folder (default `<tmp>/keel-kit`).
// `pnpm eval:public prove [--kit <dir>]`: a fresh project from the kit, given a page with JSX `If` and a `Form`
// (`proofPage.ts`), runs `keel check`, `keel docs`, `keel test` and `keel build`, and the isolation probe finds nothing
// from the repository. `pnpm eval:public selftest`: the transcript audit on a transcript that reads a forbidden path and
// one that does not, the import into a throwaway `apps/`, and the pack-time rewrite. Nothing here runs an agent.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { emit } from "../../tooling/output.ts";
import type { Diag } from "../../tooling/output.ts";
import { importApp } from "./importApp.ts";
import { audit, probe, replyFindings } from "./isolation.ts";
import { PackFindings, packKit, repoRoot, rewriteExports, stagedManifest } from "./pack.ts";
import { proveProject, setupProject } from "./project.ts";
import { writeProofPage } from "./proofPage.ts";
import { isRecord } from "./run.ts";

const diag = (code: string, path: string, message: string): Diag => ({ kind: "diag", code, path, message });
const rel = (p: string): string => p.replace(`${repoRoot}/`, "");

function flag(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function finish(diags: Diag[], trailer: string, t0: number): void {
  const body = emit(diags);
  if (body !== "") console.log(body);
  if (diags.length > 0) {
    console.log("fail eval-public");
    process.exitCode = 1;
  } else console.log(`${trailer} (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
}

async function pack(argv: readonly string[], t0: number): Promise<void> {
  const out = resolve(flag(argv, "out") ?? join(tmpdir(), "keel-kit"));
  const packed = await packKit(repoRoot, out, { build: !argv.includes("--no-build") }).catch(findings);
  if (packed === undefined) return;
  finish([], `ok eval-public pack ${packed.length} tarballs -> ${out}`, t0);
}

/** A failed pack lint as the run's diagnostics (`undefined` to the caller); any other error rethrown. */
function findings(e: unknown): undefined {
  if (!(e instanceof PackFindings)) throw e;
  finish(e.diags, "", 0);
  return undefined;
}

async function prove(argv: readonly string[], t0: number): Promise<void> {
  const given = flag(argv, "kit");
  const kit = given === undefined ? await mkdtemp(join(tmpdir(), "keel-kit-")) : resolve(given);
  if (given === undefined && (await packKit(repoRoot, kit).catch(findings)) === undefined) {
    await rm(kit, { recursive: true, force: true });
    return;
  }
  const diags: Diag[] = [];
  const project = await setupProject(kit, "proof-app");
  try {
    await writeProofPage(project.dir);
    for (const f of await probe(project.dir, repoRoot)) diags.push(diag(f.code, f.where, f.message));
    const r = await proveProject(project.dir);
    for (const s of r.steps)
      if (!s.ok)
        diags.push(
          diag("V0010", s.label, `failed: ${s.output.trim().split("\n").slice(-3).join(" | ").slice(0, 200)}`),
        );
  } finally {
    await rm(project.parent, { recursive: true, force: true });
    if (given === undefined) await rm(kit, { recursive: true, force: true });
  }
  finish(diags, "ok eval-public prove check docs test build probe", t0);
}

const line = (o: unknown): string => JSON.stringify(o);

async function selftest(t0: number): Promise<void> {
  const diags: Diag[] = [];
  const must = (ok: boolean, what: string): void => {
    if (!ok) diags.push(diag("V0010", "evals/public", what));
  };
  const project = join(tmpdir(), "keel-public-selftest", "app");
  const home = homedir();
  const call = (name: string, input: Record<string, unknown>): string =>
    line({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
  const clean = [
    call("Read", { file_path: join(project, "AGENTS.md") }),
    call("Read", { file_path: "node_modules/@keel/schema/README.md" }),
    call("Bash", { command: "pnpm exec keel docs k.router" }),
    call("Grep", { pattern: "pii", path: "modules" }),
    line({ type: "result", result: "done" }),
  ].join("\n");
  const dirty = [
    call("Bash", { command: "pnpm exec keel docs" }),
    call("Read", { file_path: join(repoRoot, "spec", "kernel", "k.schema.md") }),
    call("Read", { file_path: "../../../../../../.." + repoRoot + "/docs/PRINCIPLES.md" }),
    call("Bash", { command: `cat ${join(home, ".claude", "CLAUDE.md")}` }),
    call("Bash", { command: "ls ~/.claude/skills" }),
    call("Grep", { pattern: "export", path: join(repoRoot, "packages") }),
  ].join("\n");
  must(audit(clean, project, repoRoot).length === 0, "audit flagged a transcript that reads only the project");
  const hits = audit(dirty, project, repoRoot);
  must(hits.length >= 5, `audit found ${hits.length} of 5 forbidden reads`);
  must(
    hits.every((h) => h.code === "V0009"),
    "audit code is not V0009",
  );
  must(
    replyFindings(`${project}/CLAUDE.md\n${project}/.claude/skills/keel/SKILL.md`, project, repoRoot).length === 0,
    "probe flagged project files",
  );
  must(
    replyFindings(`${project}/CLAUDE.md\n${home}/.claude/CLAUDE.md`, project, repoRoot).length === 1,
    "probe missed a user memory file",
  );
  const exports = rewriteExports({
    ".": { types: "./src/index.ts", default: "./src/index.ts" },
    "./module": { default: "./module.ts" },
    "./client": { types: "./src/client.d.ts" },
  });
  must(
    line(exports) ===
      line({
        ".": { types: "./dist/src/index.d.ts", default: "./dist/src/index.js" },
        "./module": { default: "./dist/module.js" },
        "./client": { types: "./src/client.d.ts" },
      }),
    "rewriteExports",
  );
  const staged = stagedManifest({
    name: "@keel/x",
    version: "0.0.0",
    private: true,
    scripts: { build: "x" },
    dependencies: { "@keel/y": "workspace:*" },
    bin: { k: "./src/bin.ts" },
    publishConfig: { bin: { k: "./dist/src/bin.js" } },
  });
  must(
    isRecord(staged) &&
      !("private" in staged) &&
      line(staged["bin"]) === line({ k: "./dist/src/bin.js" }) &&
      line(staged["dependencies"]) === line({ "@keel/y": "0.0.0" }),
    "stagedManifest",
  );
  // Import of a finished project into a throwaway `apps/`.
  const scratch = await mkdtemp(join(tmpdir(), "keel-import-"));
  try {
    const made = join(scratch, "made");
    await mkdir(join(made, "modules", "shifts"), { recursive: true });
    await mkdir(join(made, "node_modules", "x"), { recursive: true });
    await mkdir(join(made, ".claude", "skills"), { recursive: true });
    await writeFile(join(made, "modules", "shifts", "routes.ts"), "export {};\n");
    await writeFile(join(made, "node_modules", "x", "i.js"), "");
    await writeFile(join(made, "AGENTS.md"), "x");
    await writeFile(join(made, "pnpm-workspace.yaml"), "overrides: {}\n");
    await writeFile(
      join(made, "package.json"),
      line({
        name: "golden-3",
        scripts: { check: "keel check" },
        dependencies: { "@keel/schema": "^0.0.0", zod: "^3" },
        devDependencies: { "@keel/cli": "^0.0.0" },
      }),
    );
    const apps = join(scratch, "apps");
    await cp(made, join(scratch, "copy"), { recursive: true });
    await importApp(join(scratch, "copy"), join(apps, "golden-3"), {
      check: "tsc --noEmit && keel check --quiet",
      build: "keel build",
    });
    const out: unknown = JSON.parse(await readFile(join(apps, "golden-3", "package.json"), "utf8"));
    const deps = isRecord(out) ? out["dependencies"] : undefined;
    must(
      isRecord(deps) && deps["@keel/schema"] === "workspace:*" && deps["zod"] === "^3",
      "import keeps non-keel ranges and maps @keel/*",
    );
    must(
      isRecord(out) && isRecord(out["scripts"]) && out["scripts"]["build"] === "keel build",
      "import writes the workspace scripts",
    );
    const left = await readFile(join(apps, "golden-3", "modules", "shifts", "routes.ts"), "utf8").catch(() => "");
    must(left !== "", "import copies sources");
    const gone = await readFile(join(apps, "golden-3", "AGENTS.md"), "utf8").catch(() => undefined);
    must(gone === undefined, "import leaves AGENTS.md behind");
    const nm = await readFile(join(apps, "golden-3", "node_modules", "x", "i.js"), "utf8").catch(() => undefined);
    must(nm === undefined, "import leaves node_modules behind");
    must(rel(apps) === apps, "throwaway apps folder is outside the repository");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  finish(diags, "ok eval-public selftest audit probe rewrite import", t0);
}

const t0 = performance.now();
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "pack") await pack(rest, t0);
else if (cmd === "prove") await prove(rest, t0);
else if (cmd === "selftest") await selftest(t0);
else {
  console.log(emit([diag("V0003", "evals/public/main.ts", "usage: eval:public pack|prove|selftest")]));
  process.exitCode = 2;
}
